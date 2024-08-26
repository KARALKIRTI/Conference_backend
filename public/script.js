// Set the date of the event (e.g., "August 30, 2024 00:00:00")
const eventDate = new Date("August 30, 2024 00:00:00").getTime();

// Update the countdown every second
const countdownInterval = setInterval(function() {
    const now = new Date().getTime();
    const timeLeft = eventDate - now;

    const weeks = Math.floor(timeLeft / (1000 * 60 * 60 * 24 * 7));
    const days = Math.floor((timeLeft % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    document.getElementById("weeks").innerText = weeks;
    document.getElementById("days").innerText = days;
    document.getElementById("hours").innerText = hours;
    document.getElementById("minutes").innerText = minutes;
    document.getElementById("seconds").innerText = seconds;

    if (timeLeft < 0) {
        clearInterval(countdownInterval);
        document.querySelector(".countdown-timer").innerHTML = "The event has started!";
    }
}, 1000);

// Function to initiate Razorpay payment
function startRazorpay(userData) {
    fetch('/create-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            var options = {
                "key": "rzp_test_RZOmakzGiuTjwu",
                "amount": data.order.amount,
                "currency": "INR",
                "name": "Conference",
                "description": "Conference Ticket Purchase",
                "order_id": data.order.id,
                "handler": function (response) {
                    alert('Payment successful!');
                    fetch('/update-payment-status', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ order_id: data.order.id })
                    })
                    .then(response => {
                        if (!response.ok) {
                            throw new Error('Network response was not ok ' + response.statusText);
                        }
                        return response.json();
                    })
                    .then(statusUpdate => {
                        if (statusUpdate.success) {
                            console.log("Payment status updated successfully");
                        } else {
                            console.log("Failed to update payment status");
                        }
                    })
                    .catch(error => {
                        console.error('Error updating payment status:', error);
                    });
                },
                "prefill": {
                    "name": userData.user.name,
                    "email": userData.user.email,
                    "contact": userData.user.phone
                },
                "theme": {
                    "color": "#3399cc"
                }
            };
            var rzp1 = new Razorpay(options);
            rzp1.open();
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('There was an error creating the order:', error);
    });
}

// Handle showing the modal when "Get Tickets" is clicked
document.getElementById('payBtn').addEventListener('click', function() {
    document.getElementById('authModal').style.display = 'block';
});

// Handle login form submission
document.getElementById('loginForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    fetch('/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Login successful!');
            document.getElementById('authModal').style.display = 'none';
            fetch('/get-user-details')
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok ' + response.statusText);
                    }
                    return response.json();
                })
                .then(userData => {
                    if (userData.success) {
                        if (userData.user.payment_status === 'done') {
                            alert('Payment already done!');
                        } else {
                            startRazorpay(userData);
                        }
                    } else {
                        alert(userData.message);
                    }
                })
                .catch(error => {
                    console.error('Error fetching user details:', error);
                });
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('There was an error with the login:', error);
    });
});

// Handle signup form submission
document.getElementById('signupForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(phone)) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }

    const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=]).{8,}$/;
    if (!passwordPattern.test(password)) {
        alert("Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.");
        return;
    }

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    fetch('/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, phone, password }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            alert('Signup successful!');
            document.getElementById('authModal').style.display = 'none';
            startRazorpay({ user: { name: name, email: email, phone: phone, payment_status: 'pending' } });
        } else {
            alert(data.message);
        }
    })
    .catch(error => {
        console.error('There was an error with the signup:', error);
    });
});

// Handle form toggle between login and signup
document.getElementById('loginToggle').addEventListener('click', function() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    this.classList.add('active');
    document.getElementById('signupToggle').classList.remove('active');
});

document.getElementById('signupToggle').addEventListener('click', function() {
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('loginForm').style.display = 'none';
    this.classList.add('active');
    document.getElementById('loginToggle').classList.remove('active');
});

// Close the modal if user clicks outside the content area
window.onclick = function(event) {
    var modal = document.getElementById('authModal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

// Add event listener for showing the signup form
document.getElementById('showSignup').addEventListener('click', function(event) {
    event.preventDefault();
    document.getElementById('signupToggle').click();
});

// Add event listener for showing the login form
document.getElementById('showLogin').addEventListener('click', function(event) {
    event.preventDefault();
    document.getElementById('loginToggle').click();
});
