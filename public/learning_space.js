document.addEventListener('DOMContentLoaded', () => {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const db = firebase.firestore();
    const learningSpaceTbody = document.getElementById('learning-space-tbody');

    function loadSharedSubmissions() {
        db.collection('submissions').orderBy('submittedAt', 'desc').onSnapshot(snapshot => {
            learningSpaceTbody.innerHTML = ''; 
            snapshot.forEach(doc => {
                const submission = doc.data();
                const row = document.createElement('tr');
                const fileName = submission.fileName || '파일 없음';
                const downloadURL = submission.downloadURL;

                row.innerHTML = `
                    <td>${submission.name}</td>
                    <td>${submission.studentClass}</td>
                    <td class="file-cell"></td>
                    <td>${submission.submittedAt ? submission.submittedAt.toDate().toLocaleString('ko-KR') : 'N/A'}</td>
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
                        fileLink.textContent = '다운로드 준비 중...';

                        fetch(downloadURL)
                            .then(res => {
                                if (!res.ok) throw new Error('네트워크 오류로 다운로드할 수 없습니다.');
                                return res.blob();
                            })
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
                            })
                            .catch((error) => {
                                console.error('파일 다운로드 오류:', error);
                                fileLink.textContent = '다운로드 실패';
                                alert('파일 다운로드 중 오류가 발생했습니다: ' + error.message);
                            });
                    });
                    fileCell.appendChild(fileLink);
                } else {
                    fileCell.textContent = fileName;
                }
                
                learningSpaceTbody.appendChild(row);
            });
        }, error => {
            console.error("데이터 로드 오류: ", error);
            learningSpaceTbody.innerHTML = `<tr><td colspan="4">데이터를 불러오는 데 실패했습니다.</td></tr>`;
        });
    }

    loadSharedSubmissions();
});
