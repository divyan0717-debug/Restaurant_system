const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

// ================= DATABASE =================

const db = new sqlite3.Database("./restaurant.db", (err) => {
    if (err) console.log(err);
    else console.log("Database connected");
});

// ================= TABLES =================

// Menu table
db.run(`
CREATE TABLE IF NOT EXISTS menu (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    price REAL,
    stock INTEGER
)
`);

// Tables table
db.run(`
CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_number INTEGER,
    seats INTEGER,
    available INTEGER
)
`);

// Orders table
db.run(`
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id INTEGER,
    quantity INTEGER,
    total REAL,
    order_time TEXT
)
`);

// Reservations table
db.run(`
CREATE TABLE IF NOT EXISTS reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT,
    table_id INTEGER,
    reservation_time TEXT
)
`);

// Root route
app.get("/", (req, res) => {
    res.send("Restaurant Management API Running 🍽️");
});
// ================= MENU APIs =================

// Add menu item
app.post("/menu", (req, res) => {

    const { name, price, stock } = req.body;

    db.run(
        `INSERT INTO menu (name, price, stock)
         VALUES (?, ?, ?)`,
        [name, price, stock],

        function (err) {

            if (err) {
                return res.status(500).json(err);
            }

            res.json({
                message: "Menu item added",
                itemId: this.lastID
            });
        }
    );
});


// View all menu items
app.get("/menu", (req, res) => {

    db.all(`SELECT * FROM menu`, [], (err, rows) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json(rows);
    });
});
// ================= TABLE APIs =================

// Add table
app.post("/tables", (req, res) => {

    const { table_number, seats } = req.body;

    db.run(
        `INSERT INTO tables
        (table_number, seats, available)
        VALUES (?, ?, 1)`,

        [table_number, seats],

        function (err) {

            if (err) {
                return res.status(500).json(err);
            }

            res.json({
                message: "Table added",
                tableId: this.lastID
            });
        }
    );
});


// View all tables
app.get("/tables", (req, res) => {

    db.all(`SELECT * FROM tables`, [], (err, rows) => {

        if (err) {
            return res.status(500).json(err);
        }

        res.json(rows);
    });
});
// ================= RESERVATION API =================

app.post("/reserve", (req, res) => {

    const {
        customer_name,
        table_id,
        reservation_time
    } = req.body;

    // Check table availability
    db.get(
        `SELECT * FROM tables WHERE id = ?`,
        [table_id],

        (err, table) => {

            if (!table || table.available === 0) {

                return res.json({
                    message: "Table not available"
                });
            }

            // Reserve table
            db.run(
                `INSERT INTO reservations
                (customer_name, table_id, reservation_time)
                VALUES (?, ?, ?)`,

                [
                    customer_name,
                    table_id,
                    reservation_time
                ],

                function (err) {

                    if (err) {
                        return res.status(500).json(err);
                    }

                    // Update availability
                    db.run(
                        `UPDATE tables
                        SET available = 0
                        WHERE id = ?`,
                        [table_id]
                    );

                    res.json({
                        message: "Table reserved successfully"
                    });
                }
            );
        }
    );
});
// ================= ORDER API =================

app.post("/orders", (req, res) => {

    const { menu_id, quantity } = req.body;

    db.get(
        `SELECT * FROM menu WHERE id = ?`,
        [menu_id],

        (err, item) => {

            if (err) {
                return res.status(500).json(err);
            }

            if (!item) {

                return res.json({
                    message: "Menu item not found"
                });
            }

            if (item.stock < quantity) {

                return res.json({
                    message: "Insufficient stock"
                });
            }

            const total = item.price * quantity;

            db.run(
                `INSERT INTO orders
                (menu_id, quantity, total, order_time)
                VALUES (?, ?, ?, datetime('now'))`,

                [menu_id, quantity, total],

                function (err) {

                    if (err) {
                        return res.status(500).json(err);
                    }

                    const newStock = item.stock - quantity;

                    db.run(
                        `UPDATE menu
                        SET stock = ?
                        WHERE id = ?`,
                        [newStock, menu_id]
                    );

                    res.json({
                        message: "Order placed successfully",
                        total: total
                    });
                }
            );
        }
    );
});
// ================= SALES REPORT APIs =================

// Total sales
app.get("/sales", (req, res) => {

    db.get(
        `SELECT SUM(total) AS total_sales FROM orders`,
        [],

        (err, row) => {

            if (err) {
                return res.status(500).json(err);
            }

            res.json(row);
        }
    );
});


// View all orders
app.get("/all-orders", (req, res) => {

    db.all(
        `
        SELECT
            orders.id,
            menu.name,
            orders.quantity,
            orders.total,
            orders.order_time

        FROM orders

        JOIN menu
        ON orders.menu_id = menu.id
        `,

        [],

        (err, rows) => {

            if (err) {
                return res.status(500).json(err);
            }

            res.json(rows);
        }
    );
});


// Low stock alert
app.get("/stock-alert", (req, res) => {

    db.all(
        `SELECT * FROM menu WHERE stock < 5`,
        [],

        (err, rows) => {

            if (err) {
                return res.status(500).json(err);
            }

            res.json(rows);
        }
    );
});

// Start server
const PORT = 5000;

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});