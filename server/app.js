const express = require('express');
const hbs = require('hbs');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const app = express();

// Configurar motor de plantillas HBS
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
hbs.registerPartials(path.join(__dirname, 'views', 'partials'));

// Servir archivos estáticos (CSS, imágenes)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Variable para determinar si estamos en Proxmox
// (En Proxmox ejecutaremos con NODE_ENV=proxmox)
const isProxmox = process.env.NODE_ENV === 'proxmox';

// Configuración de la base de datos según el entorno (igual que en 05-MySQL.md)
const dbConfig = isProxmox
  ? {
      host: '127.0.0.1',
      port: 3306,
      user: 'super',
      password: '1234',
      database: 'sakila',
    }
  : {
      host: 'localhost',        // o '127.0.0.1'
      port: 3306,                // <--- CAMBIA A 3307
      user: 'root',
      password: 'root',
      database: 'sakila',
    };

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

// Cargar datos comunes
const commonData = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'data', 'common.json'), 'utf8')
);

// Ruta principal: index
app.get('/', async (req, res) => {
  try {
    // 5 primeras películas con título, año y actores (concatenados)
    const [movies] = await pool.query(`
      SELECT f.film_id, f.title, f.release_year,
             GROUP_CONCAT(CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS actors
      FROM film f
      LEFT JOIN film_actor fa ON f.film_id = fa.film_id
      LEFT JOIN actor a ON fa.actor_id = a.actor_id
      GROUP BY f.film_id
      ORDER BY f.film_id
      LIMIT 5
    `);

    // 5 primeras categorías
    const [categories] = await pool.query(`
      SELECT category_id, name
      FROM category
      ORDER BY category_id
      LIMIT 5
    `);

    res.render('index', {
      ...commonData,
      movies,
      categories,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al carregar les dades');
  }
});

// Ruta /movies
app.get('/movies', async (req, res) => {
  try {
    // 15 primeras películas con actores
    const [movies] = await pool.query(`
      SELECT f.film_id, f.title, f.description, f.release_year,
             GROUP_CONCAT(CONCAT(a.first_name, ' ', a.last_name) SEPARATOR ', ') AS actors
      FROM film f
      LEFT JOIN film_actor fa ON f.film_id = fa.film_id
      LEFT JOIN actor a ON fa.actor_id = a.actor_id
      GROUP BY f.film_id
      ORDER BY f.film_id
      LIMIT 15
    `);

    res.render('movies', {
      ...commonData,
      movies,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al carregar les pel·lícules');
  }
});

// Ruta /customers
app.get('/customers', async (req, res) => {
  try {
    // 25 primeros clientes y sus 5 primeros alquileres
    const [customers] = await pool.query(`
      SELECT c.customer_id, c.first_name, c.last_name, c.email,
             (
               SELECT JSON_ARRAYAGG(
                 JSON_OBJECT(
                   'rental_date', r.rental_date,
                   'film_title', f.title
                 )
               )
               FROM rental r
               JOIN inventory i ON r.inventory_id = i.inventory_id
               JOIN film f ON i.film_id = f.film_id
               WHERE r.customer_id = c.customer_id
               ORDER BY r.rental_date
               LIMIT 5
             ) AS rentals_json
      FROM customer c
      ORDER BY c.customer_id
      LIMIT 25
    `);

    // Parsear el JSON de rentals (mysql2 devuelve string)
    customers.forEach(c => {
      c.rentals = c.rentals_json ? JSON.parse(c.rentals_json) : [];
      delete c.rentals_json;
    });

    res.render('customers', {
      ...commonData,
      customers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error al carregar els clients');
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escoltant al port ${PORT}`);
  console.log(`Entorn: ${isProxmox ? 'Proxmox' : 'Local'}`);
});