(function enforceAuthAndRedirect() {
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');

  if (!currentUser || !currentUser.role || !currentUser.linkedId) {
    window.location.href = '../html/login.html';
    return;
  }
})();