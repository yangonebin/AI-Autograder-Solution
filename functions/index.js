const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { GoogleGenerativeAI } = require("@google/generative-ai");

initializeApp();

// 채점 로봇의 페르소나를 정의하는 시스템 프롬프트
const systemPrompt = `
너는 'AI 학습 방법 공유 이벤트'의 과제를 채점하는 로봇이야.
사용자가 보내는 메시지는 학생이 제출한 과제물이야.
너는 아래 채점 기준에 따라 과제를 평가하고, 각 항목별 점수, 총점, 그리고 서술형 피드백을 반드시 제공해야 해.

**채점 기준:**

1.  **프롬프트의 완성도 (30점):** AI에게 목표를 얼마나 명확하고 창의적으로 제시했는지 평가해.
2.  **학습 과정의 독창성 (30점):** AI를 활용한 학습 전략이 얼마나 독창적이고 효율적이었는지 평가해.
3.  **결과물의 완성도 (20점):** 최종 결과물이 얼마나 목표에 부합하고 품질이 높은지 평가해.
4.  **공유 및 기여도 (20점):** 자신의 경험을 다른 사람에게 얼마나 잘 설명하고, 유용한 노하우를 공유했는지 평가해.

**출력 형식:**
너는 반드시 아래의 형식에 맞춰서 채점 결과를 출력해야 해. 다른 말은 절대 덧붙이지 마.

---
### **채점 결과**

*   **1. 프롬프트의 완성도:** [점수]/30점
*   **2. 학습 과정의 독창성:** [점수]/30점
*   **3. 결과물의 완성도:** [점수]/20점
*   **4. 공유 및 기여도:** [점수]/20점

---
*   **총점:** [총점]/100점

---
### **총평**

[각 항목별 점수를 부여한 이유를 포함하여, 여기에 상세하고 건설적인 피드백을 서술해줘.]
---
`;

exports.chatWithGemini = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
  console.log("chatWithGemini function triggered with grading persona.");

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  
  // 페르소나(시스템 프롬프트)를 적용하여 모델을 초기화
  const model = genAI.getGenerativeModel({ 
    model: "gemini-1.5-flash-latest",
    systemInstruction: {
      role: "model",
      parts: [{ text: systemPrompt }],
    } 
  });

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY secret is not available.");
    throw new HttpsError("internal", "The Gemini API key is not configured on the server.");
  }

  const { message } = request.data;
  console.log("Received submission for grading:", message);

  if (!message || typeof message !== 'string' || message.trim() === '') {
    console.error("Invalid message format or empty message.");
    throw new HttpsError('invalid-argument', 'The function must be called with a valid non-empty "message" string.');
  }

  try {
    console.log("Calling Gemini API with grading persona...");
    const result = await model.generateContent(message);
    const response = result.response;

    if (!response || !response.candidates || response.candidates.length === 0) {
      console.error("Gemini API returned an empty or blocked response.", JSON.stringify(response, null, 2));
      if (response && response.promptFeedback && response.promptFeedback.blockReason) {
        console.error(`Request was blocked due to: ${response.promptFeedback.blockReason}`);
        throw new HttpsError("invalid-argument", `Your request was blocked. Reason: ${response.promptFeedback.blockReason}`);
      }
      throw new HttpsError("internal", "The AI model failed to generate a response. The input may be inappropriate.");
    }

    const text = response.text();
    console.log("Gemini API grading result:", text);

    return { reply: text };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    
    if (error.message && error.message.includes("API key not valid")) {
         throw new HttpsError("unauthenticated", "The configured Gemini API key is invalid. Please check the secret value.");
    }
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An unexpected error occurred while communicating with the AI model. Check server logs for details.");
  }
});
