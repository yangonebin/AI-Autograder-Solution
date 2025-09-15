document.addEventListener('DOMContentLoaded', () => {
    // Firebase 초기화 확인
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const db = firebase.firestore();
    const storage = firebase.storage();

    const submitBtn = document.getElementById('submit-btn');
    const nameInput = document.getElementById('name');
    const studentClassInput = document.getElementById('studentClass');
    const assignmentFileInput = document.getElementById('assignmentFile');

    submitBtn.addEventListener('click', async () => {
        const name = nameInput.value;
        const studentClass = studentClassInput.value;
        const file = assignmentFileInput.files[0];

        if (!name || !studentClass || !file) {
            alert('이름, 분반, 과제 파일을 모두 입력해주세요.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '제출 중...';

        try {
            // 1. 파일을 Storage에 업로드
            const storageRef = storage.ref(`submissions/${Date.now()}_${file.name}`);
            const uploadTask = await storageRef.put(file);
            const downloadURL = await uploadTask.ref.getDownloadURL();

            // 2. Firestore에 제출 정보 저장
            await db.collection('submissions').add({
                name: name,
                studentClass: studentClass,
                fileName: file.name,
                downloadURL: downloadURL,
                submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'pending', // 채점 상태 초기값
            });

            alert('과제가 성공적으로 제출되었습니다!');
            // 입력 필드 초기화
            nameInput.value = '';
            studentClassInput.value = '';
            assignmentFileInput.value = '';

        } catch (error) {
            console.error("제출 실패: ", error);
            alert(`제출에 실패했습니다: ${error.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = '제출';
        }
    });
});
