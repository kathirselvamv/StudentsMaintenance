if (new URLSearchParams(location.search).get('expired')) {
  var b = document.getElementById('form-error'); b.textContent = 'Your session expired. Please log in again.'; b.hidden = false;
}
