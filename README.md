A Car Marketplace, powered by a robust backend architecture utilizing Express.js and MySQL, provides a seamless user experience for exploring, reviewing, and managing your favorite vehicles.

Home Page: Start here to access all our features. Log in or sign up to manage your profile and begin exploring.
User Management: This includes registration, login, and profile management. User data is secured through encrypted sessions and cookies, ensuring privacy and security.
Wishlist: Add or remove cars you're interested in. This page utilizes MySQL transactions with "Read Committed" isolation to handle data consistency and prevent issues during concurrent accesses.
Car Reviews: Submit and read reviews on different cars. We use stored procedures for inserting and fetching reviews to ensure data integrity and efficient processing.
Search for Cars: This feature allows you to filter cars by brand, model, and year using optimized SQL queries that quickly pull data from indexed columns. This ensures that search results are both fast and accurate.
Cars for You (Personalized Recommendations): Based on your interactions, such as cars added to your wishlist, this page shows cars that might interest you. If you decide to purchase a car, we use a MySQL trigger to automatically remove it from your wishlist, ensuring the data remains current.
General Reccomendations: Here we use advanced SQL queries to reccomend cars.
Purchase Car: When a purchase is made, we start a MySQL transaction to ensure all database updates related to the purchase are completed without errors before finalizing the transaction. This includes removing the car from the sale list and updating the purchase log.
Insights and Analytics: Access data-driven insights on car pricing, popularity, and market trends. We utilize advanced SQL functions to gather and present this information, helping you make informed decisions.
Logout and Session Management: Securely end your session with our logout feature, which clears your session data and cookies.

