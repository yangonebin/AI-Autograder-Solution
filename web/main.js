document.addEventListener('DOMContentLoaded', () => {

    // Firebase 앱 초기화 (firebase-config.js의 firebaseConfig 변수 사용)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const storage = firebase.storage();
    const db = firebase.firestore();

    const nameInput = document.getElementById('name');
    const classSelect = document.getElementById('class'); // 분반 선택 엘리먼트
    const fileInput = document.getElementById('assignmentFile');
    const submitBtn = document.getElementById('submitBtn');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressBar = document.getElementById('upload-progress');

    submitBtn.addEventListener('click', () => {
        const name = nameInput.value.trim();
        const studentClass = classSelect.value; // 선택된 분반 값
        const file = fileInput.files[0];

        if (!name || !file || !studentClass) {
            alert('이름, 분반, 파일을 모두 입력해주세요.');
            return;
        }

        const submissionId = Date.now().toString();
        const filePath = `submissions/${submissionId}/${file.name}`;
        const storageRef = storage.ref(filePath);
        const uploadTask = storageRef.put(file);

        submitBtn.disabled = true;
        progressContainer.style.display = 'block';

        uploadTask.on('state_changed', 
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                progressBar.textContent = Math.round(progress) + '%';
            }, 
            (error) => {
                console.error("Upload failed:", error);
                alert('파일 업로드에 실패했습니다. 다시 시도해주세요.');
                submitBtn.disabled = false;
                progressContainer.style.display = 'none';
            }, 
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    // Firestore에 제출 정보 저장 (분반 정보 포함)
                    db.collection("submissions").doc(submissionId).set({
                        name: name,
                        studentClass: studentClass, // 분반 정보 추가
                        fileName: file.name,
                        filePath: filePath,
                        downloadURL: downloadURL,
                        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: "pending"
                    })
                    .then(() => {
                        // 제출 완료 알림창 추가
                        alert("제출이 완료되었습니다!"); 
                        // 입력 필드 초기화
                        nameInput.value = '';
                        fileInput.value = '';
                        classSelect.value = '1';
                        progressContainer.style.display = 'none';
                        submitBtn.disabled = false;
                    })
                    .catch((error) => {
                        console.error("Error writing document: ", error);
                        alert('제출 정보를 저장하는 데 실패했습니다.');
                        submitBtn.disabled = false;
                    });
                });
            }
        );
    });
});
