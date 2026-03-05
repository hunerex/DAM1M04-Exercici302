const express = require('express');
const hbs = require('hbs');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const port = 3000;

// Configuración de Handlebars
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
hbs.registerPartials(path.join(__dirname, 'views/partials'));

// Archivos estáticos
app.use(express.static(path.join(__dirname, '../public')));

// Configuración de MySQL (local)
const dbConfig = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'sakila'
};

const pool = mysql.createPool(dbConfig);

// Middleware para datos comunes
app.use(async (req, res, next) => {
  const commonData = require('./data/common.json');
  res.locals.pool = pool;
  res.locals.common = commonData;
  next();
});

// Ruta principal
app.get('/', async (req, res) => {
  try {
    const [movies] = await pool.query(`
      SELECT f.film_id, f.title, f.release_year, f.description,
             (SELECT GROUP_CONCAT(CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ')
              FROM film_actor fa
              JOIN actor a ON fa.actor_id = a.actor_id
              WHERE fa.film_id = f.film_id) AS actors
      FROM film f
      ORDER BY f.film_id
      LIMIT 5
    `);

    const [categories] = await pool.query(`
      SELECT category_id, name
      FROM category
      ORDER BY category_id
      LIMIT 5
    `);

    res.render('index', {
      title: 'Página principal',
      movies,
      categories
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error en la consulta');
  }
});

// Ruta /movies
app.get('/movies', async (req, res) => {
  try {
    const [movies] = await pool.query(`
      SELECT f.film_id, f.title, f.description, f.release_year,
             (SELECT GROUP_CONCAT(CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ')
              FROM film_actor fa
              JOIN actor a ON fa.actor_id = a.actor_id
              WHERE fa.film_id = f.film_id) AS actors
      FROM film f
      ORDER BY f.film_id
      LIMIT 15
    `);

    res.render('movies', {
      title: 'Películas',
      movies
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error en la consulta');
  }
});

// Ruta /customers
app.get('/customers', async (req, res) => {
  try {
    const [customers] = await pool.query(`
      SELECT c.customer_id, c.first_name, c.last_name, c.email,
             (SELECT JSON_ARRAYAGG(
                JSON_OBJECT('rental_id', r.rental_id, 'rental_date', r.rental_date, 'title', f.title)
              )
              FROM rental r
              JOIN inventory i ON r.inventory_id = i.inventory_id
              JOIN film f ON i.film_id = f.film_id
              WHERE r.customer_id = c.customer_id
              ORDER BY r.rental_date DESC
              LIMIT 5
             ) AS rentals
      FROM customer c
      ORDER BY c.customer_id
      LIMIT 25
    `);

    customers.forEach(c => {
      if (c.rentals) {
        try {
          c.rentals = JSON.parse(c.rentals);
        } catch (e) {
          c.rentals = [];
        }
      } else {
        c.rentals = [];
      }
    });

    res.render('customers', {
      title: 'Clientes',
      customers
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error en la consulta');
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});