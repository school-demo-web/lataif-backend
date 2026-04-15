# Lataif-e-Adab - Backend API

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account
- Cloudinary account

### Installation

1. Install dependencies:
```bash
npm install
Configure environment variables:

Copy .env.example to .env

Update with your MongoDB URI, JWT secret, and Cloudinary credentials

Seed the database:

bash
npm run seed
Start the server:

bash
# Development
npm run dev

# Production
npm start
📡 API Endpoints
Authentication
POST /api/auth/register - Register new user

POST /api/auth/login - Login user

GET /api/auth/me - Get current user

Articles
GET /api/articles - Get all articles

GET /api/articles/trending - Get trending articles

GET /api/articles/:id - Get single article

POST /api/articles - Create article

PUT /api/articles/:id - Update article

DELETE /api/articles/:id - Delete article

POST /api/articles/:id/like - Like/Unlike article

Users
GET /api/users/authors - Get all authors

GET /api/users/:id - Get user profile

PUT /api/users/profile - Update profile

POST /api/users/:id/follow - Follow/Unfollow user

Comments
GET /api/comments/article/:articleId - Get article comments

POST /api/comments - Create comment

PUT /api/comments/:id/approve - Approve comment

DELETE /api/comments/:id - Delete comment

Uploads
POST /api/upload/image - Upload image

POST /api/upload/pdf - Upload PDF

Categories
GET /api/categories - Get all categories

POST /api/categories - Create category

🔧 Environment Variables
env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
📦 Deployment
Render.com
Push code to GitHub

Connect repository to Render

Add environment variables

Deploy

Railway.app
bash
railway login
railway link
railway deploy
📄 License
ISC
