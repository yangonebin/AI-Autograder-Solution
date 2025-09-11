document.addEventListener('DOMContentLoaded', () => {
    // Firebase 앱 초기화 (firebase-config.js의 firebaseConfig 변수 사용)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const db = firebase.firestore();
    const submissionsList = document.getElementById('submissions-list');

    // Firestore에서 제출 내역 실시간으로 가져와 표시
    db.collection("submissions").orderBy("submittedAt", "desc").onSnapshot((snapshot) => {
        submissionsList.innerHTML = ''; 
        if (snapshot.empty) {
            submissionsList.innerHTML = '<li>제출 내역이 없습니다.</li>';
            return;
        }

        snapshot.forEach(doc => {
            const sub = doc.data();
            const listItem = document.createElement('li');
            
            let statusText = '';
            let resultHTML = '';

            switch (sub.status) {
                case 'submitted':
                    statusText = '채점 대기 중';
                    break;
                case 'grading':
                    statusText = '채점 중...';
                    break;
                case 'graded':
                    statusText = `✅ 채점 완료 (점수: ${sub.score})`;
                    resultHTML = `<div class="feedback"><strong>피드백:</strong> ${sub.feedback.replace(/\n/g, '<br>')}</div>`;
                    break;
                case 'grading_failed':
                    statusText = `❌ 채점 실패: ${sub.error}`;
                    break;
                default:
                    statusText = '상태 알 수 없음';
            }

            listItem.innerHTML = `
                <div class="submission-header">
                    <div>
                        <strong>${sub.name}</strong> - ${sub.fileName}
                    </div>
                    <div class="submission-time">
                        ${sub.submittedAt ? new Date(sub.submittedAt.seconds * 1000).toLocaleString() : 'N/A'}
                    </div>
                </div>
                <div class="submission-status">${statusText}</div>
                ${resultHTML}
            `;
            submissionsList.appendChild(listItem);
        });
    });
});
