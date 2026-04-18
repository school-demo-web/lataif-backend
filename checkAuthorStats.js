// save as checkAuthorStats.js and run with: node checkAuthorStats.js

require('dotenv').config();
const mongoose = require('mongoose');

// Get MongoDB URI from .env
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
    console.error('❌ MongoDB URI not found in .env file!');
    console.error('Please check for: MONGODB_URI, MONGO_URI, or DATABASE_URL');
    process.exit(1);
}

console.log('📁 Using MongoDB URI:', MONGODB_URI.replace(/\/\/(.*):(.*)@/, '//***:***@')); // Hide credentials

// Import models (adjust paths based on your project structure)
const User = require('./models/User');
const Article = require('./models/Article');

async function checkAuthorStats() {
    try {
        console.log('\n🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected!\n');

        // ============================================
        // 1. OVERALL STATS
        // ============================================
        console.log('═'.repeat(70));
        console.log('📊 OVERALL STATISTICS');
        console.log('═'.repeat(70));

        const totalUsers = await User.countDocuments();
        const totalAuthors = await User.countDocuments({ role: { $in: ['author', 'admin'] } });
        const totalArticles = await Article.countDocuments();
        const publishedArticles = await Article.countDocuments({ status: 'published' });
        const draftArticles = await Article.countDocuments({ status: 'draft' });

        console.log(`   Total Users: ${totalUsers}`);
        console.log(`   Total Authors/Admins: ${totalAuthors}`);
        console.log(`   Total Articles: ${totalArticles}`);
        console.log(`   Published Articles: ${publishedArticles}`);
        console.log(`   Draft Articles: ${draftArticles}`);

        // ============================================
        // 2. AUTHOR LIST WITH STORED STATS
        // ============================================
        console.log('\n' + '═'.repeat(70));
        console.log('📋 AUTHORS WITH THEIR STORED STATS (from User model)');
        console.log('═'.repeat(70));

        const authors = await User.find({ role: { $in: ['author', 'admin'] } })
            .select('_id name email role totalArticles totalViews status')
            .sort({ name: 1 });

        console.log(`\nFound ${authors.length} authors:\n`);

        authors.forEach((author, index) => {
            console.log(`${index + 1}. ${author.name} (${author.email})`);
            console.log(`   Role: ${author.role} | Status: ${author.status || 'N/A'}`);
            console.log(`   📝 Stored totalArticles: ${author.totalArticles || 0}`);
            console.log(`   👁️ Stored totalViews: ${author.totalViews || 0}`);
            console.log('');
        });

        // ============================================
        // 3. ACTUAL ARTICLE COUNT PER AUTHOR
        // ============================================
        console.log('═'.repeat(70));
        console.log('📝 ACTUAL ARTICLE COUNT (calculated from Articles collection)');
        console.log('═'.repeat(70));

        const authorActualStats = new Map();

        // Get all published articles
        const articles = await Article.find({ status: 'published' })
            .populate('author', '_id name email')
            .sort({ publishedAt: -1 });

        articles.forEach(article => {
            if (!article.author) {
                console.log(`⚠️ Article "${article.title}" has NO author assigned`);
                return;
            }

            const authorId = article.author._id.toString();
            const authorName = article.author.name;
            const authorEmail = article.author.email;

            if (authorActualStats.has(authorId)) {
                const stats = authorActualStats.get(authorId);
                stats.articleCount++;
                stats.totalViews += article.views || 0;
                stats.articles.push({
                    title: article.title,
                    views: article.views || 0,
                    publishedAt: article.publishedAt
                });
            } else {
                authorActualStats.set(authorId, {
                    authorId,
                    authorName,
                    authorEmail,
                    articleCount: 1,
                    totalViews: article.views || 0,
                    articles: [{
                        title: article.title,
                        views: article.views || 0,
                        publishedAt: article.publishedAt
                    }]
                });
            }
        });

        const statsArray = Array.from(authorActualStats.values());
        statsArray.sort((a, b) => b.articleCount - a.articleCount);

        console.log(`\nAuthors with published articles: ${statsArray.length}\n`);

        statsArray.forEach((stat, index) => {
            console.log(`${index + 1}. ${stat.authorName} (${stat.authorEmail})`);
            console.log(`   Actual Article Count: ${stat.articleCount}`);
            console.log(`   Actual Total Views: ${stat.totalViews}`);
            console.log(`   Articles:`);
            stat.articles.slice(0, 5).forEach(article => {
                console.log(`      - "${article.title}" (${article.views} views)`);
            });
            if (stat.articles.length > 5) {
                console.log(`      ... and ${stat.articles.length - 5} more`);
            }
            console.log('');
        });

        // ============================================
        // 4. DISCREPANCIES CHECK
        // ============================================
        console.log('═'.repeat(70));
        console.log('🔍 DISCREPANCIES (Stored vs Actual)');
        console.log('═'.repeat(70));

        const discrepancies = [];

        authors.forEach(author => {
            const authorId = author._id.toString();
            const storedArticles = author.totalArticles || 0;
            const storedViews = author.totalViews || 0;
            
            const actual = authorActualStats.get(authorId);
            const actualArticles = actual ? actual.articleCount : 0;
            const actualViews = actual ? actual.totalViews : 0;

            if (storedArticles !== actualArticles || storedViews !== actualViews) {
                discrepancies.push({
                    name: author.name,
                    email: author.email,
                    storedArticles,
                    actualArticles,
                    storedViews,
                    actualViews,
                    diffArticles: actualArticles - storedArticles,
                    diffViews: actualViews - storedViews
                });
            }
        });

        if (discrepancies.length > 0) {
            console.log(`\n⚠️ Found ${discrepancies.length} authors with mismatched stats:\n`);
            
            discrepancies.forEach((d, index) => {
                console.log(`${index + 1}. ${d.name} (${d.email})`);
                console.log(`   Articles: Stored=${d.storedArticles} | Actual=${d.actualArticles} | Diff=${d.diffArticles > 0 ? '+' : ''}${d.diffArticles}`);
                console.log(`   Views:    Stored=${d.storedViews} | Actual=${d.actualViews} | Diff=${d.diffViews > 0 ? '+' : ''}${d.diffViews}`);
                console.log('');
            });
        } else {
            console.log('\n✅ All author stats match! No discrepancies found.');
        }

        // ============================================
        // 5. AUTHORS WITH NO ARTICLES
        // ============================================
        console.log('═'.repeat(70));
        console.log('📭 AUTHORS WITH ZERO PUBLISHED ARTICLES');
        console.log('═'.repeat(70));

        const authorsWithNoArticles = authors.filter(author => {
            const authorId = author._id.toString();
            return !authorActualStats.has(authorId);
        });

        console.log(`\nFound ${authorsWithNoArticles.length} authors with 0 published articles:\n`);

        authorsWithNoArticles.forEach((author, index) => {
            console.log(`${index + 1}. ${author.name} (${author.email})`);
            console.log(`   Stored totalArticles: ${author.totalArticles || 0}`);
            console.log(`   Stored totalViews: ${author.totalViews || 0}`);
            console.log('');
        });

        // ============================================
        // 6. ARTICLES WITHOUT AUTHORS
        // ============================================
        console.log('═'.repeat(70));
        console.log('⚠️ ARTICLES WITHOUT VALID AUTHOR');
        console.log('═'.repeat(70));

        const articlesWithoutAuthor = await Article.find({ 
            $or: [
                { author: null },
                { author: { $exists: false } }
            ]
        }).select('title status publishedAt');

        if (articlesWithoutAuthor.length > 0) {
            console.log(`\nFound ${articlesWithoutAuthor.length} articles with no author:\n`);
            articlesWithoutAuthor.forEach((article, index) => {
                console.log(`${index + 1}. "${article.title}" (Status: ${article.status})`);
            });
        } else {
            console.log('\n✅ All articles have authors assigned.');
        }

        // ============================================
        // 7. SUMMARY
        // ============================================
        console.log('\n' + '═'.repeat(70));
        console.log('📌 SUMMARY');
        console.log('═'.repeat(70));
        console.log(`   Total Authors: ${authors.length}`);
        console.log(`   Authors with published articles: ${statsArray.length}`);
        console.log(`   Authors with 0 articles: ${authorsWithNoArticles.length}`);
        console.log(`   Authors with mismatched stats: ${discrepancies.length}`);
        console.log(`   Total Published Articles: ${publishedArticles}`);
        console.log(`   Articles without author: ${articlesWithoutAuthor.length}`);

        if (discrepancies.length > 0) {
            console.log('\n⚠️  Run the fix script to correct these discrepancies!');
        }

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('\n📴 Disconnected from MongoDB');
    }
}

// Run the check
checkAuthorStats();