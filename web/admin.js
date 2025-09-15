document.addEventListener('DOMContentLoaded', () => {
    // Firebase 초기화 확인
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const db = firebase.firestore();
    const functions = firebase.functions();

    // HTML 요소
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginBtn = document.getElementById('login-btn');
    const userIdInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');
    const signOutBtn = document.getElementById('sign-out-btn');
    const submissionsTbody = document.getElementById('submissions-tbody');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const studentNameInput = document.getElementById('student-name-input');
    const scoreInput = document.getElementById('score-input');
    const manualGradeBtn = document.getElementById('manual-grade-btn');

    // 페이지 로드 시 로그인 상태 확인
    if (sessionStorage.getItem('isAdminLoggedIn') === 'true') {
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';
        signOutBtn.style.display = 'block';
        initializeDashboard();
    } else {
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
        signOutBtn.style.display = 'none';
    }

    // 로그인 버튼 클릭 이벤트
    loginBtn.addEventListener('click', () => {
        const userId = userIdInput.value;
        const password = passwordInput.value;
        loginError.textContent = '';

        if (!userId || !password) {
            loginError.textContent = 'ID와 비밀번호를 모두 입력해주세요.';
            return;
        }

        db.collection('admins').where('username', '==', userId).where('password', '==', password).get()
            .then(snapshot => {
                if (snapshot.empty) {
                    loginError.textContent = 'ID 또는 비밀번호가 잘못되었습니다.';
                } else {
                    sessionStorage.setItem('isAdminLoggedIn', 'true');
                    location.reload();
                }
            })
            .catch(error => {
                console.error("로그인 쿼리 오류:", error);
                loginError.textContent = '로그인 중 오류가 발생했습니다.';
            });
    });

    // 로그아웃
    signOutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('isAdminLoggedIn');
        location.reload();
    });

    function initializeDashboard() {
        loadSubmissions();
        setupChatbot();
        setupManualGrading();
    }

    // 수동 점수 등록 기능
    function setupManualGrading() {
        manualGradeBtn.addEventListener('click', () => {
            const studentName = studentNameInput.value.trim();
            const score = parseInt(scoreInput.value, 10);

            if (!studentName || isNaN(score)) {
                alert('학생 이름과 점수를 올바르게 입력해주세요.');
                return;
            }

            db.collection('submissions').where('name', '==', studentName).get()
                .then(snapshot => {
                    if (snapshot.empty) {
                        alert('해당 이름의 학생을 찾을 수 없습니다.');
                        return;
                    }

                    const batch = db.batch();
                    snapshot.forEach(doc => {
                        batch.update(doc.ref, { grade: score });
                    });

                    return batch.commit();
                })
                .then(() => {
                    alert('점수가 성공적으로 등록되었습니다.');
                    studentNameInput.value = '';
                    scoreInput.value = '';
                    // 점수 등록 후 목록을 새로고침할 수 있습니다.
                    // loadSubmissions(); 
                })
                .catch(error => {
                    console.error('점수 등록 오류:', error);
                    alert('점수 등록 중 오류가 발생했습니다.');
                });
        });
    }

    // 과제 목록 로드 (다운로드 기능 수정)
    function loadSubmissions() {
        db.collection('submissions').orderBy('submittedAt', 'desc').onSnapshot(snapshot => {
            submissionsTbody.innerHTML = '';
            let counter = 1;
            snapshot.forEach(doc => {
                const submission = doc.data();
                const row = document.createElement('tr');
                const fileName = submission.fileName || '파일 없음';
                const downloadURL = submission.downloadURL;

                row.innerHTML = `
                    <td>${counter++}</td>
                    <td>${submission.name}</td>
                    <td>${submission.studentClass}</td>
                    <td class="file-cell"></td>
                    <td>${submission.submittedAt ? submission.submittedAt.toDate().toLocaleString('ko-KR') : 'N/A'}</td>
                    <td>${submission.status || 'pending'}</td>
                    <td>${submission.grade || 'N/A'}</td>
                    <td>${submission.feedback || 'N/A'}</td>
                `;

                const fileCell = row.querySelector('.file-cell');

                if (downloadURL) {
                    const fileLink = document.createElement('a');
                    fileLink.href = '#';
                    fileLink.textContent = fileName;
                    fileLink.style.cursor = 'pointer';
                    fileLink.style.textDecoration = 'underline';

                    fileLink.addEventListener('click', (e) => {
                        e.preventDefault();
                        const originalText = fileLink.textContent;
                        fileLink.textContent = '준비 중...';

                        fetch(downloadURL)
                            .then(res => res.blob())
                            .then(blob => {
                                const blobUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.style.display = 'none';
                                a.href = blobUrl;
                                a.download = fileName;
                                document.body.appendChild(a);
                                a.click();
                                window.URL.revokeObjectURL(blobUrl);
                                a.remove();
                                fileLink.textContent = originalText;
                            }).catch(() => {
                                fileLink.textContent = '다운로드 실패';
                                alert('파일 다운로드에 실패했습니다.');
                            });
                    });
                    fileCell.appendChild(fileLink);
                } else {
                    fileCell.textContent = fileName;
                }

                submissionsTbody.appendChild(row);
            });
        });
    }

    function setupChatbot() {
        const chatWithGemini = functions.httpsCallable('chatWithGemini');
        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message === '' || chatSendBtn.disabled) return;

            appendMessage(message, 'user');
            chatInput.value = '';
            chatInput.disabled = true;
            chatSendBtn.disabled = true;

            chatWithGemini({ message: message })
                .then(result => appendMessage(result.data.reply, 'bot'))
                .catch(error => {
                    console.error("챗봇 오류:", error);
                    appendMessage('죄송합니다. 답변을 생성하는 중 오류가 발생했습니다.', 'bot');
                })
                .finally(() => {
                    chatInput.disabled = false;
                    chatSendBtn.disabled = false;
                    chatInput.focus();
                });
        };

        chatSendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', e => e.key === 'Enter' && sendMessage());
    }
    
    function appendMessage(text, sender) {
        const messageElement = document.createElement('div');
        messageElement.classList.add('chat-message', `${sender}-message`);
        messageElement.textContent = text;
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
});
