var express = require('express');
var bodyParser = require('body-parser');
var mysql = require('mysql2');
var path = require('path');
var session = require('express-session');
var cookieParser = require('cookie-parser');

var connection = mysql.createConnection({
    host: '34.123.111.135',
    user: 'root',
    password: '1234',
    database: 'findacardb'
});

// Connect to the database
connection.connect(function(err) {
    if (err) {
        console.error('Error connecting to the database: ' + err.stack);
        return;
    }
    console.log('Connected to database with thread ID: ' + connection.threadId);
});

var app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());
app.use(session({secret: 'q8x2zpoRQUpsIAC2JeB7zWhWK1BMTDXpNS4VaomXozQ'}));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Home page route
app.get('/', function(req, res) {
    res.render('index');
});

// Route to display user creation form
app.get('/create-user', function(req, res) {
    res.render('user'); // Assumes you have a 'user.ejs' file to render
});

// Route to display login form
app.get('/login', function(req, res) {
    res.render('login');
});

// User dashboard
app.get('/dashboard', function(req, res) {
    if (req.session.username) { // Check if user is logged in
        res.render('dashboard', { username: req.session.username });
    } else {
        res.redirect('/login');
    }
});


app.get('/wishlist', function(req, res) {
    if (!req.session.username) {
        res.redirect('/login'); // Redirect to login if user is not logged in
        return;
    }
    var username = req.session.username;
    var sql = 'SELECT CarId FROM Wishlist WHERE username = ?';
    connection.query(sql, [username], function(err, results) {
        if (err) {
            res.status(500).render('wishlist', { error: 'Error retrieving wishlist' });
        } else {
            var sql2 = 'SELECT BrandName, Model, Year FROM Cars WHERE CarId IN (?)';   
            connection.query(sql2, [results.map(r => r.CarId)], function(err, carResults) {
                if (err) {
                    res.status(500).render('wishlist', { error: 'Error retrieving wishlist', items: []});
                } else {
                    res.render('wishlist', { items: carResults });
                }
            });
        }
    });
});

app.get('/your-reviews', function(req, res) {
    if(!req.session.username) {
        res.redirect('/login');
        return;
    }
    var username = req.session.username;
    var sql = `SELECT u.username, u.Review, s.SellerName, c.Model, c.BrandName, c.Year 
    FROM UserCarReviews u
    JOIN Cars c ON u.CarId = c.CarId
    LEFT JOIN Sellers s ON u.SellerId = s.SellerId
    WHERE u.username = ?`;
    connection.query(sql, [username], function(err, results) {
        if (err) {
            res.status(500).render('your-reviews', { error: 'Error retrieving reviews' });
        } else {
            res.render('your-reviews', { reviews: results || []});
        }
    });
});

app.get('/logout', function(req, res) {
    req.session.destroy();
    res.redirect('/');
});

app.get('/reviews', function(req, res) {
    if (!req.session.username) {
        res.redirect('/login'); // Redirect to login if user is not logged in
        return;
    }
    res.render('reviews');
});

// Route to handle login form submission
app.post('/login', function(req, res) {
    // Example of simple authentication and redirection:
    var username = req.body.username;

    var sql = 'SELECT * FROM User WHERE username = ? ';
    connection.query(sql, [username], function(err, results) {
        if (err || results.length === 0) {
            res.render('login', { error: 'Invalid credentials' });
        } else {
            req.session.username = username;
            res.redirect('/dashboard');
        }
    });
});

app.post('/create-user', function(req, res) {
    var userData = {
        username: req.body.username,
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        email: req.body.email,
        phone: req.body.phone,
        location: req.body.location
    };

    var sql = `INSERT INTO User SET ?`;
    connection.query(sql, userData, function(err, result) {
        if (err) {
            console.error('Error in creating user: ' + err);
            res.status(500).render('user', { error: 'Error in creating user: ' + err });
        } else {
            req.session.username = userData.username;
            console.log('User created successfully with ID: ' + result.insertId);
            // res.redirect('/dashboard?username=' + encodeURIComponent(req.body.username));
            res.redirect('/dashboard');
        }
    });
});

app.post('/create-wishlist', function(req, res) {
    if (!req.session.username) {
        res.status(401).send({ message: 'You need to be logged in to add cars to wishlist' });
        return;
    }

    var username = req.session.username;
    // var carId = req.body.carId;
    // get BrandName, Model, Year from the form
    var carData = {
        BrandName: req.body.BrandName,
        Model: req.body.Model,
        Year: req.body.Year
    };
    
    // First check if the carId exists in the database
    var checkCarIdSql = 'SELECT CarId FROM Cars WHERE BrandName = ? AND Model = ? AND Year = ?';
    connection.query(checkCarIdSql, [carData.BrandName, carData.Model, carData.Year], function(err, carResults) {
        if (err) {
            res.status(500).send({ message: 'Database error checking car ID', error: err });
            return;
        }

        if (carResults.length === 0) {
            // No car with this ID exists, send a warning message
            res.render('wishlist', { message: 'No car found with the provided ID', items: [] });
            return;
        }
        var carId = carResults[0].CarId;
        // Car ID exists, proceed with inserting into Wishlist
        var sql = `INSERT INTO Wishlist (username, CarId) VALUES (?, ?)`;
        connection.query(sql, [username, carId], function(err, result) {
            if (err) {
                res.status(500).send({ message: 'Error in adding car to wishlist', error: err });
            } else {
                res.redirect('/wishlist');
            }
        });
    });
});

app.post('/fetch-reviews', function(req, res) {
    var carData = {
        BrandName: req.body.BrandName,
        Model: req.body.Model,
        Year: req.body.Year
    };

    var carQuery = 'SELECT CarId FROM Cars WHERE BrandName = ? AND Model = ? AND Year = ?';
    connection.query(carQuery, [carData.BrandName, carData.Model, carData.Year], function(err, results) {
        if (err) {
            res.status(500).send({ message: 'Error fetching Car', error: err });
            return;
        } 
        if (results.length === 0) {
            res.status(404).send({ message: 'Car not found' });
            return;
        }
        var carId = results[0].CarId;
        var reviewQuery = `SELECT username, Review, SellerName 
                           FROM UserCarReviews U
                           LEFT JOIN Sellers S ON U.SellerId = S.SellerId
                           WHERE CarId = ?`;
        connection.query(reviewQuery, [carId], function(err, reviewResults) {
            if (err) {
                res.status(500).send({ message: 'Error fetching reviews', error: err });
                return;
            }
            res.render('reviews', { reviews: reviewResults});
        });
    });
});

app.post('/submit-review', function(req, res) {
    if (!req.session.username) {
        res.status(401).send({ message: 'You need to be logged in to submit reviews' });
        return;
    }

    var username = req.session.username;
    var brandName = req.body.BrandName;
    var model = req.body.Model;
    var year = req.body.Year;
    var reviewText = req.body.reviewText;
    var SellerName = req.body.SellerName || '';

    var sql = 'CALL SubmitReview(?, ?, ?, ?, ?, ?)';
    connection.query(sql, [username, brandName, model, year, reviewText, SellerName], function(err, results) {
        if (err) {
            res.status(500).send({ message: 'Error submitting review', error: err });
        } else {
            res.redirect('/your-reviews');
        }
    });
});

app.get('/cars-for-you', function(req, res) {
    if (!req.session.username) {
        res.redirect('/login');
        return;
    }
    const username = req.session.username;

    // Fetch CarIds from the user's wishlist
    const wishlistQuery = 'SELECT CarId FROM Wishlist WHERE username = ?';
    connection.query(wishlistQuery, [username], function(err, wishlistResults) {
        if (err) {
            res.status(500).render('cars-for-you', { error: 'Error retrieving wishlist' , items: []});
            return;
        }

        if (wishlistResults.length === 0) {
            // No items in the wishlist
            res.render('cars-for-you', { message: 'No items in your wishlist.' , items: []});
        } else {
            // Fetch cars that are listed in CarsForSale with the same CarId
            const carsQuery = `
            SELECT VIN, Cars.BrandName, Cars.Model, Cars.Year, Sellers.SellerName, Type, ExteriorColor, InteriorColor, 
            Drivetrain, CityMPG, HighwayMPG, Engine, Transmission, Mileage, Price
            FROM CarsForSale 
            JOIN Sellers ON CarsForSale.SellerId = Sellers.SellerId
            JOIN Cars ON CarsForSale.CarId = Cars.CarId
            WHERE CarsForSale.CarId IN (?)
        `;
            connection.query(carsQuery, [wishlistResults.map(car => car.CarId)], function(err, carsResults) {
                if (err) {
                    res.status(500).render('cars-for-you', { error: 'Error retrieving cars for sale', items: [] });
                    return;
                }
                res.render('cars-for-you', { items: carsResults });
            });
        }
    });
});

app.post('/purchase-car', function(req, res) {
    const VIN = req.body.VIN;
    const username = req.session.username;

    if (!username) {
        return res.status(401).send({ success: false, message: "Login required" });
    }

    // First, set the transaction isolation level
    connection.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED', (err) => {
        if (err) {
            console.error('Error setting isolation level:', err);
            return res.status(500).send({ success: false, message: "Failed to set isolation level" });
        }

        // Now, start the transaction
        connection.beginTransaction(err => {
            if (err) {
                console.error('Transaction Start Error:', err);
                return res.status(500).send({ success: false, message: "Transaction could not start" });
            }

            // Verify the car is available
            connection.query('SELECT CarId FROM CarsForSale WHERE VIN = ?', [VIN], (err, results) => {
                if (err || results.length === 0) {
                    let message = err ? "Error checking car availability" : "Car not available for purchase";
                    return connection.rollback(() => {
                        res.status(404).send({ success: false, message });
                    });
                }
                const carId = results[0].CarId;
                // Delete the car from CarsForSale
                connection.query('DELETE FROM CarsForSale WHERE VIN = ?', [VIN], (err, result) => {
                    if (err) {
                        return connection.rollback(() => {
                            console.error('Error deleting car:', err);
                            res.status(500).send({ success: false, message: "Failed to delete car" });
                        });
                    }

                    // Delete the car from Wishlist
                    connection.query('DELETE FROM Wishlist WHERE CarId = ? AND username = ?', [carId, username], (err, result) => {
                        if (err) {
                            return connection.rollback(() => {
                                console.error('Error deleting from wishlist:', err);
                                res.status(500).send({ success: false, message: "Failed to delete from wishlist" });
                            });
                        }

                        const logSql = 'INSERT INTO PurchaseLog (username, VIN, CarId, Date) VALUES (?, ?, ?, NOW())';
                        // Log the purchase
                        connection.query(logSql, [username, VIN, carId], (err, result) => {
                            if (err) {
                                return connection.rollback(() => {
                                    console.error('Error logging purchase:', err);
                                    res.status(500).send({ success: false, message: "Failed to log purchase" });
                                });
                            }

                            // Commit the transaction
                            connection.commit(err => {
                                if (err) {
                                    console.error('Error committing transaction:', err);
                                    return connection.rollback(() => {
                                        res.status(500).send({ success: false, message: "Failed to commit purchase" });
                                    });
                                }
                                res.send({ success: true, message: "Purchase completed successfully" });
                            });
                        });
                    });
                });
            });
        });
    });
});

app.get('/search-for-cars', function(req, res) {
    if (!req.session.username) {
        res.redirect('/login');
        return;
    }
    res.render('search-for-cars', { results: [] });
});

app.post('/fetch-search', function(req, res) {
    const { BrandName, Model, Year } = req.body;
    let queryParams = [BrandName.toLowerCase()];
    let carQuery = 'SELECT CarId FROM Cars WHERE LOWER(BrandName) = ?';

    if (Model) {
        carQuery += ' AND LOWER(Model) = ?';
        queryParams.push(Model.toLowerCase());
    }
    
    if (Year) {
        carQuery += ' AND Year = ?';
        queryParams.push(Year); // Assuming validation ensures this is a valid year
    }

    connection.query(carQuery, queryParams, (err, results) => {
        if (err) {
            console.error('SQL Error:', err);
            return res.status(500).render('search-for-cars', {
                results: [],
                error: 'Database error occurred.'
            });
        }

        if (results.length === 0) {
            return res.render('search-for-cars', {
                results: [],
                message: 'No cars found matching your criteria.'
            });
        }

        const carIds = results.map(result => result.CarId);
        const reviewQuery = `
            SELECT VIN, Cars.BrandName, Cars.Model, Cars.Year, Sellers.SellerName, Type, ExteriorColor, InteriorColor,
            Drivetrain, CityMPG, HighwayMPG, Engine, Transmission, Mileage, Price
            FROM CarsForSale
            JOIN Sellers ON CarsForSale.SellerId = Sellers.SellerId
            JOIN Cars ON CarsForSale.CarId = Cars.CarId
            WHERE CarsForSale.CarId IN (?)
        `;

        connection.query(reviewQuery, [carIds], (err, carsResults) => {
            if (err) {
                console.error('Error fetching cars for sale:', err);
                return res.status(500).render('search-for-cars', {
                    results: [],
                    error: 'Failed to fetch car details.'
                });
            }
            res.render('search-for-cars', { results: carsResults });
        });
    });
});



// SQL code
app.get('/runsql', function(req, res) {
    res.render('runsql');
});

app.get('/executesqlPriceMPG', function(req, res) {
    var sql = 'SELECT b.BrandName, AVG(cs.Price) as new_price FROM CarsForSale cs JOIN Cars c ON c.CarId = cs.CarId JOIN Brands b ON b.BrandName = c.BrandName GROUP BY b.BrandName HAVING AVG(cs.CityMPG) > 20 ORDER BY AVG(cs.Price) DESC LIMIT 15';
    connection.query(sql, function(err, results) {
        if (err) {
            res.status(500).send({ message: 'Error executing SQL command', error: err });
        } else {
            res.send(renderResultsPriceMPG(results));
        }
    });
});

function renderResultsPriceMPG(results) {
    var html = '<h2>Recommendation Results:</h2>';
    html += '<table>';
    html += '<tr><th>Brand</th><th>Price</th></tr>';
    results.forEach(function(row) {
        html += '<tr>';
        html += '<td>' + row.BrandName + '</td>';
        html += '<td>' + row.new_price + '</td>';
        html += '</tr>';
    });
    html += '</table>';
    return html;
}


app.get('/executesqlStatelist', function(req, res) {
    var sql = 'SELECT list_of_states.State, COUNT(list_of_states.CarId) AS list FROM((SELECT s.State, cs.CarId FROM CarsForSale cs JOIN Sellers s ON cs.SellerId = s.SellerId WHERE LOWER(cs.ExteriorColor) LIKE \'%red%\') UNION (SELECT s.State, cs.CarId FROM CarsForSale cs JOIN Sellers s ON cs.SellerId = s.SellerId WHERE LOWER(cs.Engine) LIKE \'%turbo%\' and cs.Price > 30000)) list_of_states GROUP BY list_of_states.State ORDER BY COUNT(list_of_states.CarId) DESC LIMIT 15';
    connection.query(sql, function(err, results) {
        if (err) {
            res.status(500).send({ message: 'Error executing SQL command', error: err });
        } else {
            res.send(renderResultsStatelist(results));
        }
    });
});

function renderResultsStatelist(results) {
    var html = '<h2>Recommendation Results:</h2>';
    html += '<table>';
    html += '<tr><th>State</th><th>Sus Cars</th></tr>';
    results.forEach(function(row) {
        html += '<tr>';
        html += '<td>' + row.State + '</td>';
        html += '<td>' + row.list + '</td>';
        html += '</tr>';
    });
    html += '</table>';
    return html;
}


app.get('/executesqlCheapBrandRating', function(req, res) {
    var sql = `SELECT brand_prices.BrandName, avg_rating.avg_r 
            FROM (SELECT avg_prices.BrandName, MAX(avg_prices.avg_state) as cost 
                    FROM (SELECT s.State, c.BrandName, AVG(cs.Price) as avg_state 
                            FROM CarsForSale cs JOIN Sellers s ON cs.SellerId = s.SellerId 
                            JOIN Cars c ON c.CarId = cs.CarId 
                            GROUP BY s.State, c.BrandName) avg_prices 
                    GROUP BY avg_prices.BrandName) brand_prices 
            JOIN (SELECT c.BrandName, AVG(s.SellerRating) as avg_r 
                    FROM CarsForSale cs 
                    JOIN Sellers s ON cs.SellerId = s.SellerId JOIN Cars c ON c.CarId = cs.CarId 
                    GROUP BY c.BrandName) avg_rating 
            ON avg_rating.BrandName = brand_prices.BrandName 
            ORDER BY brand_prices.cost LIMIT 15`;
    connection.query(sql, function(err, results) {
        if (err) {
            res.status(500).send({ message: 'Error executing SQL command', error: err });
        } else {
            res.send(renderResultsCheapBrandRating(results));
        }
    });
});

function renderResultsCheapBrandRating(results) {
    var html = '<h2>Recommendation Results:</h2>';
    html += '<table>';
    html += '<tr><th>Brand</th><th>Avg Rating</th></tr>';
    results.forEach(function(row) {
        html += '<tr>';
        html += '<td>' + row.BrandName + '</td>';
        html += '<td>' + row.avg_r + '</td>';
        html += '</tr>';
    });
    html += '</table>';
    return html;
}

app.get('/executesqlYrsHighMPG', function(req, res) {
    var sql = `WITH avg_mpg_py_pb AS (SELECT c.BrandName, c.year, AVG(cs.HighwayMPG) as avg_mpg FROM CarsForSale cs
    JOIN Cars c ON cs.CarId = c.CarId GROUP BY c.BrandName, c.year)
    SELECT a.BrandName, a.year FROM avg_mpg_py_pb a
    JOIN (SELECT BrandName, MAX(avg_mpg) as max_mpg FROM avg_mpg_py_pb GROUP BY BrandName) max_mpg_py 
    ON a.avg_mpg = max_mpg_py.max_mpg AND a.BrandName = max_mpg_py.BrandName ORDER BY a.year DESC`;
    connection.query(sql, function(err, results) {
        if (err) {
            res.status(500).send({ message: 'Error executing SQL command', error: err });
        } else {
            res.send(renderResultsYrsHighMPG(results));
        }
    });
});

function renderResultsYrsHighMPG(results) {
    var html = '<h2>Recommendation Results:</h2>';
    html += '<table>';
    html += '<tr><th>Brand</th><th>Avg Rating</th></tr>';
    results.forEach(function(row) {
        html += '<tr>';
        html += '<td>' + row.BrandName + '</td>';
        html += '<td>' + row.year + '</td>';
        html += '</tr>';
    });
    html += '</table>';
    return html;
}





// Start the server
app.listen(3000, function () {
    console.log('Node app is running on port 80'); // Correct the port number in the log
});
