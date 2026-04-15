// migrate.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const User = require('../models/User');
const Article = require('../models/Article');
const Category = require('../models/Category');
const Comment = require('../models/Comment');

const JSON_FILE_PATH = path.join(__dirname, '..', '..', 'bhaiya_database.json');

async function migrate() {
    try {
        console.log('🔄 Starting Full Database Migration...\n');

        // Read JSON
        if (!fs.existsSync(JSON_FILE_PATH)) {
            console.error('❌ JSON file not found at:', JSON_FILE_PATH);
            process.exit(1);
        }

        const fileContent = fs.readFileSync(JSON_FILE_PATH, 'utf8');
        const jsonArray = JSON.parse(fileContent);
        console.log('✅ JSON file loaded successfully\n');

        // Extract all tables
        const tables = {};
        jsonArray.forEach(item => {
            if (item.type === 'table' && item.data) {
                tables[item.name] = item.data;
                console.log(`   📊 Table: ${item.name} (${item.data.length} records)`);
            }
        });
        console.log('');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Optional: Clear existing data
        if (process.argv.includes('--clear')) {
            console.log('⚠️ Clearing existing data...');
            await User.deleteMany({});
            await Article.deleteMany({});
            await Category.deleteMany({});
            await Comment.deleteMany({});
            console.log('✅ Database cleared\n');
        }

        // 1. Migrate Categories
        console.log('📂 Migrating Categories...');
        const categoryMap = new Map();
        for (const cat of tables.categories || []) {
            let category = await Category.findOne({ name: cat.name });
            if (!category) {
                category = await Category.create({
                    name: cat.name,
                    slug: cat.slug || cat.name.toLowerCase().replace(/\s+/g, '-'),
                    description: cat.description || '',
                    isActive: true
                });
                console.log(`   ✅ Created: ${category.name}`);
            } else {
                console.log(`   ⏭️ Exists: ${category.name}`);
            }
            categoryMap.set(String(cat.id), category._id);
        }
        console.log(`   📊 Categories: ${categoryMap.size}\n`);

        // 2. Migrate Authors (Users)
        console.log('👤 Migrating Authors...');
        const authorMap = new Map();
        for (const auth of tables.authors || []) {
            let user = await User.findOne({ email: auth.email });
            if (!user) {
                user = await User.create({
                    name: auth.name || auth.username || 'Unknown',
                    email: auth.email,
                    password: auth.password, // already hashed
                    role: auth.role === 'admin' ? 'admin' : 'author',
                    bio: auth.bio || '',
                    status: auth.status || 'approved',
                    avatar: auth.avatar || null
                });
                console.log(`   ✅ Created: ${user.name}`);
            } else {
                console.log(`   ⏭️ Exists: ${user.email}`);
            }
            authorMap.set(String(auth.id), user._id);
        }
        console.log(`   📊 Authors: ${authorMap.size}\n`);

        // 3. Migrate Articles (posts1 table)
        console.log('📝 Migrating Articles...');
        let articleCount = 0;
        const defaultAuthor = Array.from(authorMap.values())[0];
        const defaultCategory = Array.from(categoryMap.values())[0];

        for (const post of tables.posts1 || []) {
            try {
                if (!post.title) continue;

                const existing = await Article.findOne({ title: post.title });
                if (existing) continue;

                await Article.create({
                    title: post.title,
                    content: post.content || post.excerpt || '',
                    excerpt: post.excerpt || (post.content ? post.content.substring(0, 250) : ''),
                    author: authorMap.get(String(post.author_id)) || defaultAuthor,
                    category: categoryMap.get(String(post.category_id)) || defaultCategory,
                    featuredImage: post.image_url || post.image || '',
                    pdfAttachment: post.pdf || '',
                    status: post.status === 'published' ? 'published' : 'draft',
                    isPublic: true,
                    allowComments: true,
                    views: parseInt(post.view_count) || 0,
                    likes: [],
                    tags: []
                });

                articleCount++;
                if (articleCount % 20 === 0) console.log(`   ✅ Migrated ${articleCount} articles...`);

            } catch (err) {
                console.error(`   ❌ Failed article "${post.title?.substring(0, 40)}..." → ${err.message}`);
            }
        }
        console.log(`   📊 Articles Imported: ${articleCount}\n`);

        // 4. Migrate Comments
        console.log('💬 Migrating Comments...');
        let commentCount = 0;

        const allArticles = await Article.find({}).select('_id title');
        const articleMapByTitle = new Map();
        allArticles.forEach(article => articleMapByTitle.set(article.title, article._id));

        for (const comment of tables.comments || []) {
            try {
                if (!comment.comment || comment.status !== 'approved') continue;

                // Find matching article (fallback to first article)
                let articleId = null;
                for (const [title, id] of articleMapByTitle) {
                    if (title && comment.post_id) {
                        articleId = id;
                        break;
                    }
                }
                if (!articleId) articleId = allArticles[0]?._id;

                const existing = await Comment.findOne({
                    article: articleId,
                    content: comment.comment
                });

                if (!existing) {
                    await Comment.create({
                        article: articleId,
                        guestName: comment.name || 'Anonymous',
                        content: comment.comment,
                        status: 'approved'
                    });
                    commentCount++;
                }
            } catch (err) {
                // silent skip
            }
        }
        console.log(`   📊 Comments Imported: ${commentCount}\n`);

        // Final Summary
        console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
        console.log('====================================');
        console.log(`Categories : ${await Category.countDocuments()}`);
        console.log(`Users      : ${await User.countDocuments()}`);
        console.log(`Articles   : ${await Article.countDocuments()}`);
        console.log(`Comments   : ${await Comment.countDocuments()}`);
        console.log('====================================');

    } catch (error) {
        console.error('❌ Migration Failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
    }
}

// Run migration
migrate();