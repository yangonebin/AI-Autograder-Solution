document.addEventListener('DOMContentLoaded', function () {
    // Firebase 앱 초기화 (firebase-config.js의 firebaseConfig 변수 사용)
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    } else {
        firebase.app();
    }

    const storage = firebase.storage();
    const db = firebase.firestore();
    const auth = firebase.auth();

    // DOM 요소 가져오기
    const uploadForm = document.getElementById('upload-form');
    const nameInput = document.getElementById('name');
    const fileInput = document.getElementById('assignment-file');
    const submitButton = document.getElementById('submit-button');
    const feedbackMessage = document.getElementById('feedback-message');

    // 관리자 로그인 관련 요소
    const adminLoginButton = document.getElementById('admin-login-button');
    const adminLoginModal = document.getElementById('admin-login-modal');
    const closeButton = document.querySelector('.modal .close-button');
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const loginError = document.getElementById('login-error');

    // --- 과제 제출 처리 --- //
    uploadForm.addEventListener('submit', function (e) {
        e.preventDefault();

        const name = nameInput.value;
        const file = fileInput.files[0];

        if (!file) {
            feedbackMessage.textContent = '파일을 선택해주세요.';
            feedbackMessage.className = 'error';
            return;
        }

        submitButton.disabled = true;
        feedbackMessage.textContent = '제출 중입니다...';
        feedbackMessage.className = 'info';

        const submissionId = Date.now().toString();
        const filePath = `submissions/${submissionId}/${file.name}`;
        const storageRef = storage.ref(filePath);
        const uploadTask = storageRef.put(file);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                console.log('Upload is ' + progress + '% done');
            },
            (error) => {
                console.error("Upload failed: ", error);
                feedbackMessage.textContent = '파일 업로드에 실패했습니다. 다시 시도해주세요.';
                feedbackMessage.className = 'error';
                submitButton.disabled = false;
            },
            () => {
                uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                    console.log('File available at', downloadURL);

                    db.collection('submissions').add({
                        name: name,
                        fileName: file.name,
                        filePath: filePath,
                        downloadURL: downloadURL,
                        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
                        status: 'pending'
                    }).then(() => {
                        feedbackMessage.textContent = '제출이 성공적으로 완료되었습니다!';
                        feedbackMessage.className = 'success';
                        uploadForm.reset();
                    }).catch((error) => {
                        console.error("Error writing document: ", error);
                        feedbackMessage.textContent = '제출 정보를 저장하는 데 실패했습니다.';
                        feedbackMessage.className = 'error';
                    }).finally(() => {
                        submitButton.disabled = false;
                    });
                });
            }
        );
    });

    // --- 관리자 로그인 처리 (데이터베이스 조회 방식) --- //
    adminLoginButton.addEventListener('click', (e) => {
        e.preventDefault();
        adminLoginModal.style.display = 'block';
    });

    closeButton.addEventListener('click', () => {
        adminLoginModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == adminLoginModal) {
            adminLoginModal.style.display = 'none';
        }
    });

    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const username = usernameInput.value;
        const password = passwordInput.value;
        loginError.textContent = '';

        db.collection('admins').where('username', '==', username).get()
            .then((querySnapshot) => {
                if (querySnapshot.empty) {
                    loginError.textContent = '아이디 또는 비밀번호가 잘못되었습니다.';
                    return;
                }

                let userFound = false;
                querySnapshot.forEach((doc) => {
                    if (doc.data().password === password) {
                        userFound = true;
                        console.log('관리자 로그인 성공:', doc.data().username);
                        window.location.href = 'admin.html';
                    }
                });

                if (!userFound) {
                    loginError.textContent = '아이디 또는 비밀번호가 잘못되었습니다.';
                }
            })
            .catch((error) => {
                console.error('로그인 중 오류 발생:', error);
                loginError.textContent = '로그인 중 오류가 발생했습니다.';
            });
    });
});
