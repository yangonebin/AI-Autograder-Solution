document.addEventListener('DOMContentLoaded', () => {

    // Firebase 초기화
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const db = firebase.firestore();
    const functions = firebase.functions();
    const submissionsTbody = document.getElementById('submissions-tbody');

    // --- 채점 기능 관련 --- //
    const gradeSubmission = functions.httpsCallable('gradeSubmissionManually');

    db.collection("submissions").orderBy("submittedAt", "desc")
        .onSnapshot((snapshot) => {
            submissionsTbody.innerHTML = '';
            let index = 1;
            snapshot.forEach(doc => {
                const submission = doc.data();
                const submissionId = doc.id;
                const row = document.createElement('tr');
                row.dataset.id = submissionId;

                let statusTag = '';
                let isClickable = submission.status === 'pending' || submission.status === 'error';

                switch (submission.status) {
                    case 'pending': statusTag = `<span class="status status-pending">대기중</span>`; break;
                    case 'grading': statusTag = `<span class="status status-grading">채점중</span>`; break;
                    case 'graded': statusTag = `<span class="status status-graded">채점완료</span>`; break;
                    case 'error': statusTag = `<span class="status status-error">오류</span>`; break;
                    default: statusTag = submission.status;
                }

                if (isClickable) row.classList.add('clickable-row');

                row.innerHTML = `
                    <td>${index++}</td>
                    <td>${submission.name}</td>
                    <td>${submission.studentClass}반</td>
                    <td><a href="${submission.downloadURL}" target="_blank" rel="noopener noreferrer">${submission.fileName}</a></td>
                    <td>${submission.submittedAt.toDate().toLocaleString()}</td>
                    <td>${statusTag}</td>
                    <td>${submission.grade !== undefined ? submission.grade : 'N/A'}</td>
                    <td class="feedback-cell" title="${submission.feedback || ''}">${submission.feedback || 'N/A'}</td>
                `;
                submissionsTbody.appendChild(row);
            });
        });

    submissionsTbody.addEventListener('click', async (event) => {
        const row = event.target.closest('tr.clickable-row');
        if (!row) return;
        const submissionId = row.dataset.id;
        if (confirm(`'${row.querySelector('td:nth-child(2)').textContent}' 학생의 과제를 채점하시겠습니까?`)) {
            row.classList.remove('clickable-row');
            try {
                await gradeSubmission({ submissionId: submissionId });
                alert('채점 요청에 성공했습니다. 잠시 후 결과가 자동으로 업데이트됩니다.');
            } catch (error) {
                console.error('채점 함수 호출 오류:', error);
                alert(`채점 요청에 실패했습니다: ${error.message}`);
            }
        }
    });

    // --- Gemini 어시스턴트 챗봇 관련 --- //
    // 백엔드 함수 이름과 일치하도록 'chatWithGemini'로 수정
    const chatWithGemini = functions.httpsCallable('chatWithGemini');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');

    const addMessage = (message, sender) => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', `${sender}-message`);
        messageElement.textContent = message;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight; // 항상 최신 메시지로 스크롤
    };

    const handleSendMessage = async () => {
        const message = chatInput.value.trim();
        if (!message) return;

        addMessage(message, 'user');
        chatInput.value = '';
        chatInput.disabled = true;
        chatSendBtn.disabled = true;

        try {
            // 수정된 함수를 호출
            const result = await chatWithGemini({ message: message });
            addMessage(result.data.reply, 'bot');
        } catch (error) {
            console.error('챗봇 함수 호출 오류:', error);
            addMessage('죄송합니다. 답변을 생성하는 중 오류가 발생했습니다.', 'bot');
        } finally {
            chatInput.disabled = false;
            chatSendBtn.disabled = false;
            chatInput.focus();
        }
    };

    chatSendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSendMessage();
        }
    });
});
