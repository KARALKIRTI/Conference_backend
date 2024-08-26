// Set the date of the event (e.g., "August 30, 2024 00:00:00")
const eventDate = new Date("August 30, 2024 00:00:00").getTime();

// Update the countdown every second
const countdownInterval = setInterval(function() {

    // Get the current date and time
    const now = new Date().getTime();

    // Find the time difference between now and the event date
    const timeLeft = eventDate - now;

    // Time calculations for weeks, days, hours, minutes, and seconds
    const weeks = Math.floor(timeLeft / (1000 * 60 * 60 * 24 * 7));
    const days = Math.floor((timeLeft % (1000 * 60 * 60 * 24 * 7)) / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Display the results in the respective HTML elements
    document.getElementById("weeks").innerText = weeks;
    document.getElementById("days").innerText = days;
    document.getElementById("hours").innerText = hours;
    document.getElementById("minutes").innerText = minutes;
    document.getElementById("seconds").innerText = seconds;

    // If the countdown is over, stop the timer and optionally display a message
    if (timeLeft < 0) {
        clearInterval(countdownInterval);
        document.querySelector(".countdown-timer").innerHTML = "The event has started!";
    }

}, 1000); // Update every second

// Function to initiate Razorpay payment
function startRazorpay(userData) {
    // Check if payment is already done
    if (userData.user.payment_status === 'done') {
        alert('Payment already done!');
        return; // Do not proceed with Razorpay if payment is already done
    }

    // Create a Razorpay order
    fetch('/create-order', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(order => {
        var options = {
            "key": "rzp_test_RZOmakzGiuTjwu", // Enter the Key ID generated from the Dashboard
            "amount": order.amount, // Amount is in currency subunits. Default currency is INR. Hence, 50000 means 50000 paise or ₹500.00.
            "currency": "INR",
            "name": "Conference",
            "description": "Conference Ticket Purchase",
            "order_id": order.id, // This is the order_id created in the backend.
            "handler": function (response){
                alert('Payment successful!');
                // Update payment status in the database
                fetch('/update-payment-status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ order_id: order.id })
                })
                .then(response => response.json())
                .then(statusUpdate => {
                    if (statusUpdate.success) {
                        console.log("Payment status updated successfully");
                    } else {
                        console.log("Failed to update payment status");
                    }
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
    });
}

// Handle showing the modal when "Get Tickets" is clicked
document.getElementById('payBtn').addEventListener('click', function() {
    // Check if the user is already logged in
    fetch('/check-login')
        .then(response => response.json())
        .then(data => {
            if (!data.loggedIn) {
                document.getElementById('authModal').style.display = 'block';
            } else {
                // User is logged in, fetch their details
                fetch('/get-user-details')
                    .then(response => response.json())
                    .then(userData => {
                        if (userData.success) {
                            startRazorpay(userData);
                        } else {
                            alert(userData.message);
                        }
                    });
            }
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

// Validate signup form before submission
document.getElementById('signupForm').addEventListener('submit', function(event) {
    event.preventDefault();

    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value; // Added phone number field
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Validate phone number (10 digits)
    const phonePattern = /^[0-9]{10}$/;
    if (!phonePattern.test(phone)) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }

    // Validate password (at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, 1 special character)
    const passwordPattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[@#$%^&+=]).{8,}$/;
    if (!passwordPattern.test(password)) {
        alert("Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.");
        return;
    }

    // Check if passwords match
    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    // If all validations pass, submit the form
    fetch('/signup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, phone, password }), // Include phone in the signup request
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Signup successful!');
            document.getElementById('authModal').style.display = 'none';
            // Automatically start Razorpay after signup
            startRazorpay({ user: { name: name, email: email, phone: phone, payment_status: 'pending' } });
        } else {
            alert(data.message);
        }
    });
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
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            alert('Login successful!');
            document.getElementById('authModal').style.display = 'none';
            // Automatically start Razorpay after login
            fetch('/get-user-details')
                .then(response => response.json())
                .then(userData => {
                    if (userData.success) {
                        startRazorpay(userData);
                    } else {
                        alert(userData.message);
                    }
                });
        } else {
            alert(data.message);
        }
    });
});
