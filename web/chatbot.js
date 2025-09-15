document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    // 전송 버튼 클릭 시 메시지 처리
    sendChatBtn.addEventListener('click', () => {
        const userMessage = chatInput.value.trim();
        if (userMessage) {
            appendMessage(userMessage, 'user');
            handleBotResponse(userMessage);
            chatInput.value = '';
        }
    });

    // Enter 키로 메시지 전송
    chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            sendChatBtn.click();
        }
    });

    // 채팅 기록에 메시지 추가
    function appendMessage(message, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', `${sender}-message`);
        const p = document.createElement('p');
        p.textContent = message;
        messageElement.appendChild(p);
        chatHistory.appendChild(messageElement);
        chatHistory.scrollTop = chatHistory.scrollHeight; // 항상 최신 메시지가 보이도록 스크롤
    }

    // 봇 응답 처리 (기본적인 응답 로직)
    function handleBotResponse(userMessage) {
        let botMessage = "죄송합니다. 아직 해당 명령어는 이해할 수 없습니다. '채점 시작'이라고 말씀해보시겠어요?";

        if (userMessage.includes('채점 시작')) {
            botMessage = "좋습니다! 어떤 학생의 과제를 채점할까요? 아래 표에서 학생을 선택한 후, '선택한 학생 채점'이라고 입력해주세요.";
        } else if (userMessage.includes('선택한 학생 채점')) {
            botMessage = "채점 기능을 준비 중입니다. 곧 업데이트될 예정이니 조금만 기다려주세요!";
            // 여기에 나중에 실제 채점 로직을 연결하게 됩니다.
        }

        // 봇 메시지를 약간의 딜레이 후 추가하여 실제 대화처럼 보이게 함
        setTimeout(() => {
            appendMessage(botMessage, 'bot');
        }, 500);
    }
});
