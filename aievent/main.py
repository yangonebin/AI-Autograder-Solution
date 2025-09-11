
import os
import requests
import firebase_admin
from firebase_admin import firestore, storage
from firebase_functions import firestore_fn, options
import google.generativeai as genai

# Firebase 앱 초기화
firebase_admin.initialize_app()

# Gemini API 키 설정 (환경 변수에서 가져오기)
gemini_api_key = os.environ.get("GEMINI_API_KEY")
if not gemini_api_key:
    raise ValueError("GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.")
genai.configure(api_key=gemini_api_key)

@firestore_fn.on_document_created(document="submissions/{submissionId}")
def aievent(event: firestore_fn.Event[firestore_fn.Change]) -> None:
    """Firestore에 새로운 과제가 제출되면 Gemini를 사용하여 채점합니다."""

    submission_id = event.params["submissionId"]
    submission_data = event.data.to_dict()

    file_url = submission_data.get("fileURL")
    if not file_url:
        print(f"오류: {submission_id} 문서에 fileURL이 없습니다.")
        return

    try:
        # 1. Cloud Storage에서 과제 파일 다운로드
        response = requests.get(file_url)
        response.raise_for_status()  # 요청이 실패하면 예외 발생
        assignment_content = response.text

        # 2. Gemini AI 모델을 사용하여 채점
        model = genai.GenerativeModel('gemini-1.5-flash')
        prompt = f"""
        다음은 학생이 제출한 과제입니다. 아래 기준에 따라 채점하고, 피드백을 한국어로 작성해주세요.

        과제 내용:
        {assignment_content}

        ---
        채점 기준:
        - 0~100점 척도로 채점해주세요.
        - 코드의 완성도, 창의성, 효율성을 종합적으로 평가해주세요.
        - 잘한 점과 개선할 점을 명확하게 설명해주세요.

        결과는 다음 JSON 형식으로 반환해주세요:
        {{
            "score": <점수>,
            "feedback": "<피드백 내용>"
        }}
        """
        
        response = model.generate_content(prompt)
        
        # Gemini 응답에서 JSON 데이터 추출 및 파싱
        # 응답 텍스트 앞뒤의 ```json ... ``` 부분을 제거
        cleaned_response_text = response.text.strip().replace("```json", "").replace("```", "")
        import json
        result = json.loads(cleaned_response_text)
        
        score = result.get("score")
        feedback = result.get("feedback")

        if score is None or feedback is None:
            raise ValueError("Gemini 응답에서 점수 또는 피드백을 추출할 수 없습니다.")

        # 3. Firestore 문서에 점수와 피드백 업데이트
        db = firestore.client()
        db.collection("submissions").document(submission_id).update({
            "score": score,
            "feedback": feedback,
            "status": "graded"
        })
        print(f"성공: {submission_id} 과제가 채점되었습니다. 점수: {score}")

    except requests.exceptions.RequestException as e:
        print(f"오류: 과제 파일을 다운로드하는 데 실패했습니다. {e}")
        db.collection("submissions").document(submission_id).update({"status": "grading_failed", "error": str(e)})
    except json.JSONDecodeError as e:
        print(f"오류: Gemini 응답을 파싱하는 데 실패했습니다. 응답: {response.text}, 오류: {e}")
        db.collection("submissions").document(submission_id).update({"status": "grading_failed", "error": f"Gemini 응답 파싱 오류: {response.text}"})
    except Exception as e:
        print(f"오류: 채점 중 예기치 않은 오류가 발생했습니다. {e}")
        db.collection("submissions").document(submission_id).update({"status": "grading_failed", "error": str(e)})

