
import os
import firebase_admin
from firebase_admin import firestore, storage
from firebase_functions import firestore_fn
import google.generativeai as genai
import json

# Firebase 앱 초기화
firebase_admin.initialize_app()

# Gemini API 키 설정 (환경 변수에서 가져오기)
gemini_api_key = os.environ.get("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.")
genai.configure(api_key=gemini_api_key)

# Firestore 및 Storage 클라이언트 초기화
db = firestore.client()
def get_default_bucket_name():
    # 프로젝트 ID를 기반으로 기본 버킷 이름을 동적으로 생성
    project_id = os.environ.get('GCP_PROJECT') or os.environ.get('GCLOUD_PROJECT')
    if not project_id:
        print("경고: GCP 프로젝트 ID를 환경 변수에서 찾을 수 없습니다.")
        # 대체 버킷 이름 또는 오류 처리
        return "ai-autograder-solution.appspot.com" 
    return f"{project_id}.appspot.com"

bucket_name = get_default_bucket_name()

@firestore_fn.on_document_created(document="submissions/{submissionId}")
def aievent(event: firestore_fn.Event[firestore_fn.Change], context) -> None:
    """Firestore에 새로운 과제가 제출되면 Gemini를 사용하여 채점합니다."""

    submission_id = event.params["submissionId"]
    submission_data = event.data.to_dict()

    submission_ref = db.collection("submissions").document(submission_id)
    submission_ref.update({"status": "grading"})

    file_path = submission_data.get("filePath")
    if not file_path:
        print(f"오류: {submission_id} 문서에 filePath가 없습니다.")
        submission_ref.update({"status": "grading_failed", "error": "파일 경로 없음"})
        return

    try:
        # 1. GCS에서 직접 과제 파일 다운로드
        bucket = storage.bucket(bucket_name)
        blob = bucket.blob(file_path)
        file_bytes = blob.download_as_bytes()

        # 다양한 인코딩으로 파일 내용 디코딩 시도
        assignment_content = None
        encodings_to_try = ['utf-8', 'cp949', 'euc-kr']
        
        for encoding in encodings_to_try:
            try:
                assignment_content = file_bytes.decode(encoding)
                print(f"성공: 파일 내용을 '{encoding}'(으)로 디코딩했습니다.")
                break
            except UnicodeDecodeError:
                print(f"정보: '{encoding}'(으)로 디코딩 실패. 다음 인코딩을 시도합니다.")
                continue
        
        if assignment_content is None:
            print(f"오류: {submission_id} 파일의 인코딩을 식별할 수 없습니다.")
            submission_ref.update({
                "status": "grading_failed",
                "error": "파일 인코딩을 해석할 수 없습니다. (UTF-8 또는 CP949로 저장해주세요)"
            })
            return

        # 2. Gemini AI 모델을 사용하여 채점
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        다음은 학생이 AI 활용 경험에 대해 제출한 과제 보고서입니다. 아래의 명확한 채점 기준에 따라, 각 항목별 점수를 포함하여 총점을 계산하고 구체적인 피드백을 한국어로 작성해주세요.

        과제 내용:
        ---
        {assignment_content}
        ---

        채점 기준:
        1.  **프롬프트의 완성도 (총 30점):** AI에게 목표를 얼마나 명확하고, 구체적이며, 창의적으로 제시했는지를 평가합니다.
        2.  **학습 과정의 독창성 (총 30점):** 단순히 AI를 사용한 것을 넘어, AI를 활용하여 자신만의 학습 전략이나 문제 해결 방식을 얼마나 독창적이고 효율적으로 만들었는지를 평가합니다.
        3.  **결과물의 완성도 (총 20점):** 최종 결과물이 원래 의도했던 목표에 얼마나 부합하는지, 그리고 그 품질이 얼마나 높은지를 평가합니다.
        4.  **공유 및 기여도 (총 20점):** 자신의 AI 활용 경험과 노하우를 다른 사람들이 이해하기 쉽게 설명하고, 다른 사람들에게 실질적으로 도움이 될 만한 유용한 팁이나 인사이트를 공유했는지를 평가합니다.

        요구사항:
        - 각 채점 기준 항목별로 점수를 개별적으로 부여해주세요.
        - 모든 항목의 점수를 합산하여 최종 총점을 계산해주세요.
        - 학생이 잘한 점과 앞으로 개선하면 좋을 점을 구체적인 근거를 들어 서술형으로 작성해주세요.

        결과는 반드시 다음 JSON 형식에 맞춰서 반환해주세요. 다른 텍스트나 설명 없이 JSON 객체만 반환해야 합니다:
        {{
            "scores": {{
                "prompt_completeness": <프롬프트 완성도 점수>,
                "learning_creativity": <학습 과정 독창성 점수>,
                "output_quality": <결과물 완성도 점수>,
                "sharing_contribution": <공유 및 기여도 점수>
            }},
            "total_score": <총점>,
            "feedback": "<구체적인 종합 피드백 내용>"
        }}
        """
        
        gemini_response = model.generate_content(prompt)
        
        cleaned_response_text = gemini_response.text.strip().replace("```json", "").replace("```", "")
        result = json.loads(cleaned_response_text)
        
        total_score = result.get("total_score")
        feedback = result.get("feedback")
        scores = result.get("scores")

        if total_score is None or feedback is None or scores is None:
            raise ValueError("Gemini 응답에서 필수 필드를 추출할 수 없습니다.")

        # 3. Firestore 문서에 점수와 피드백 업데이트
        submission_ref.update({
            "scores": scores,
            "score": total_score,
            "feedback": feedback,
            "status": "graded"
        })
        print(f"성공: {submission_id} 과제가 채점되었습니다. 총점: {total_score}")

    except Exception as e:
        print(f"오류: 채점 중 예기치 않은 오류가 발생했습니다. {e}")
        submission_ref.update({"status": "grading_failed", "error": str(e)})
