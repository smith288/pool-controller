document.addEventListener('DOMContentLoaded', () => {
  const pinBoxes = document.querySelectorAll('.pin-box');
  
  // Handle input in pin boxes
  pinBoxes.forEach((box, index) => {
    box.addEventListener('input', (e) => {
      if (e.target.value) {
        // Move to next box
        if (index < pinBoxes.length - 1) {
          pinBoxes[index + 1].focus();
        }
        // If it's the last box, submit
        if (index === pinBoxes.length - 1) {
          validatePin();
        }
      }
    });

    // Handle backspace
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && index > 0) {
        pinBoxes[index - 1].focus();
      }
    });
  });

  function validatePin() {
    const pin = Array.from(pinBoxes).map(box => box.value).join('');
    
    
    // Construct the login endpoint path
    const loginPath = `/login`;
    
    fetch(loginPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pin })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
          // Redirect to base path, ensuring no double slashes
        window.location.href = '/';
      } else {
        document.querySelector('.error-message').textContent = 'Invalid PIN';
        // Clear and focus first box
        pinBoxes.forEach(box => box.value = '');
        pinBoxes[0].focus();
      }
    })
    .catch(error => {
      console.error('Error:', error);
      document.querySelector('.error-message').textContent = 'An error occurred';
    });
  }

  // Focus first box on load
  window.addEventListener('load', () => {
    pinBoxes[0].focus();
  });
}); 