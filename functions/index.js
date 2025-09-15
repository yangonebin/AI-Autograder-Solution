const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

// Gemini API 키를 환경 변수에서 가져옵니다.
const genAI = new GoogleGenerativeAI(functions.config().gemini.api_key);
const firestore = admin.firestore();

/**
 * 관리자가 수동으로 채점을 트리거하는 함수
 */
exports.gradeSubmissionManually = functions.https.onCall(async (data, context) => {
    // 사용자가 인증되었는지 확인합니다.
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const submissionId = data.submissionId;
    if (!submissionId) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with one argument "submissionId".');
    }

    const submissionRef = firestore.collection('submissions').doc(submissionId);

    try {
        await submissionRef.update({ status: 'grading' });

        const submissionDoc = await submissionRef.get();
        if (!submissionDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Submission not found.');
        }
        const submissionData = submissionDoc.data();

        // Gemini AI 모델을 사용하여 채점 및 피드백 생성
        const model = genAI.getGenerativeModel({ model: "gemini-pro"});
        const prompt = `
        다음 학생의 과제를 채점하고, 100점 만점 기준으로 점수를 매겨주세요. 
        피드백은 한국어 존댓말로, 강점이 무엇인지, 개선할 점이 무엇인지 상세하게 설명해주세요.
        출력 형식은 반드시 JSON 형식이어야 하며, 다른 말은 절대 추가하지 마세요.
        {
          "grade": [점수],
          "feedback": "[피드백 내용]"
        }

        --- 학생 과제 내용 ---
        ${submissionData.fileContent}
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        
        const gradedResult = JSON.parse(text);

        await submissionRef.update({
            status: 'graded',
            grade: gradedResult.grade,
            feedback: gradedResult.feedback
        });

        return { success: true, submissionId: submissionId };

    } catch (error) {
        console.error("Grading error for submission:", submissionId, error);
        await submissionRef.update({ status: 'error', error: error.message });
        throw new functions.https.HttpsError('internal', 'An error occurred while grading the submission.', { submissionId: submissionId });
    }
});

/**
 * 일반적인 질문에 답변하는 챗봇 함수
 */
exports.askChatbot = functions.https.onCall(async (data, context) => {
    // 사용자가 인증되었는지 확인
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'The function must be called while authenticated.');
    }

    const userMessage = data.message;
    if (!userMessage) {
        throw new functions.https.HttpsError('invalid-argument', 'The function must be called with one argument "message".');
    }

    try {
        // Gemini AI의 범용 모델을 사용
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const result = await model.generateContent(userMessage);
        const response = await result.response;
        const text = await response.text();

        return { reply: text };

    } catch (error) {
        console.error("Chatbot error:", error);
        throw new functions.https.HttpsError('internal', 'An error occurred while getting a response from the chatbot.');
    }
});
