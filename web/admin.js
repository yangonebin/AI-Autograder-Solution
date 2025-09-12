document.addEventListener('DOMContentLoaded', () => {
    // Firebase 앱 초기화
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const db = firebase.firestore();
    const submissionsTableBody = document.getElementById('submissions-tbody');

    // URL로부터 파일을 강제로 다운로드하는 함수
    const forceDownload = (url, fileName) => {
        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok.');
                return response.blob(); // 응답을 Blob으로 변환
            })
            .then(blob => {
                const blobUrl = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = fileName;
                document.body.appendChild(link);
                link.click(); // 링크를 프로그래매틱하게 클릭하여 다운로드 실행
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl); // 메모리 해제
            })
            .catch(error => {
                console.error('Download failed:', error);
                alert('파일을 다운로드하는 중 오류가 발생했습니다.');
            });
    };

    // Firestore에서 제출 내역 실시간으로 가져와 표로 표시
    db.collection("submissions").orderBy("submittedAt", "desc").onSnapshot((snapshot) => {
        submissionsTableBody.innerHTML = ''; 
        if (snapshot.empty) {
            submissionsTableBody.innerHTML = '<tr><td colspan="7">제출 내역이 없습니다.</td></tr>';
            return;
        }

        let counter = 1;
        snapshot.forEach(doc => {
            const sub = doc.data();
            const row = document.createElement('tr');
            
            let statusText = '';
            let scoreDisplay = '';

            switch (sub.status) {
                case 'pending':
                    statusText = '<span>채점 대기 중</span>';
                    break;
                case 'grading':
                    statusText = '<span class="status-grading">채점 중...</span>';
                    break;
                case 'graded':
                    statusText = '<span class="status-graded">✅ 채점 완료</span>';
                    let scoresTooltip = '항목별 점수:\n';
                    if(sub.scores) {
                        for(const key in sub.scores) {
                            scoresTooltip += `${key}: ${sub.scores[key]}\n`;
                        }
                    }
                    scoresTooltip += `\n종합 피드백:\n${sub.feedback}`;
                    scoreDisplay = `<span title="${scoresTooltip}">${sub.score}점</span>`;
                    break;
                case 'grading_failed':
                    statusText = `<span class="status-failed" title="${sub.error}">❌ 채점 실패</span>`;
                    scoreDisplay = '-';
                    break;
                default:
                    statusText = `<span>${sub.status || '알 수 없음'}</span>`;
            }
            
            // innerHTML로 기본 행 구조 생성
            row.innerHTML = `
                <td>${counter}</td>
                <td>${sub.name || '-'}</td>
                <td>${sub.studentClass ? sub.studentClass + '반' : '-'}</td>
                <td></td> <!-- 파일 링크는 아래에서 동적으로 채움 -->
                <td>${scoreDisplay}</td>
                <td>${sub.submittedAt ? new Date(sub.submittedAt.seconds * 1000).toLocaleString() : 'N/A'}</td>
                <td>${statusText}</td>
            `;

            // 파일 링크 셀을 동적으로 생성하고 이벤트 리스너 추가
            const fileCell = row.children[3];
            const fileLink = document.createElement('a');
            fileLink.href = '#';
            fileLink.textContent = sub.fileName;
            fileLink.style.cursor = 'pointer';
            fileLink.onclick = (e) => {
                e.preventDefault(); // 기본 동작 방지
                forceDownload(sub.downloadURL, sub.fileName);
            };
            
            fileCell.appendChild(fileLink);
            submissionsTableBody.appendChild(row);
            counter++;
        });
    });
});
