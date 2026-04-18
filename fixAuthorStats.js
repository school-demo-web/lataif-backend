require('dotenv').config();
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DATABASE_URL;

if (!MONGODB_URI) {
    console.error('MongoDB URI not found in .env file!');
    process.exit(1);
}

console.log('Using MongoDB URI:', MONGODB_URI.replace(/\/\/(.*):(.*)@/, '//***:***@'));

const User = require('./models/User');
const Article = require('./models/Article');

async function fixAuthorStats() {
    try {
        console.log('\n🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected!\n');

        console.log('═'.repeat(70));
        console.log('🔧 FIXING AUTHOR STATISTICS');
        console.log('═'.repeat(70));

        // Get all published articles
        const articles = await Article.find({ status: 'published' })
            .populate('author', '_id name');

        // Calculate stats per author
        const authorStats = new Map();

        articles.forEach(article => {
            if (!article.author) return;

            const authorId = article.author._id.toString();
            const authorName = article.author.name;

            if (authorStats.has(authorId)) {
                const stats = authorStats.get(authorId);
                stats.articleCount++;
                stats.totalViews += article.views || 0;
            } else {
                authorStats.set(authorId, {
                    authorId,
                    authorName,
                    articleCount: 1,
                    totalViews: article.views || 0
                });
            }
        });

        console.log(`\n📊 Found ${authorStats.size} authors with published articles\n`);

        // Update each author in database
        for (const [authorId, stats] of authorStats) {
            const result = await User.findByIdAndUpdate(
                authorId,
                {
                    totalArticles: stats.articleCount,
                    totalViews: stats.totalViews
                },
                { new: true }
            );

            if (result) {
                console.log(`✅ ${stats.authorName}:`);
                console.log(`   📝 totalArticles: ${stats.articleCount}`);
                console.log(`   👁️ totalViews: ${stats.totalViews}`);
            } else {
                console.log(`❌ Failed to update ${stats.authorName}`);
            }
            console.log('');
        }

        // Reset authors with 0 articles
        const allAuthors = await User.find({ role: { $in: ['author', 'admin'] } });
        
        console.log('═'.repeat(70));
        console.log('🔄 RESETTING AUTHORS WITH ZERO ARTICLES');
        console.log('═'.repeat(70));

        for (const author of allAuthors) {
            const authorId = author._id.toString();
            if (!authorStats.has(authorId)) {
                await User.findByIdAndUpdate(authorId, {
                    totalArticles: 0,
                    totalViews: 0
                });
                console.log(`✅ ${author.name}: reset to 0 articles, 0 views`);
            }
        }

        console.log('\n' + '═'.repeat(70));
        console.log('🎉 ALL AUTHOR STATS FIXED SUCCESSFULLY!');
        console.log('═'.repeat(70));

        // Show summary after fix
        console.log('\n📋 UPDATED STATISTICS:\n');
        
        const updatedAuthors = await User.find({ role: { $in: ['author', 'admin'] } })
            .select('name totalArticles totalViews')
            .sort({ totalArticles: -1 });

        updatedAuthors.forEach((author, index) => {
            console.log(`${index + 1}. ${author.name}`);
            console.log(`   📝 Articles: ${author.totalArticles || 0}`);
            console.log(`   👁️ Views: ${author.totalViews || 0}`);
            console.log('');
        });

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error(error.stack);
    } finally {
        await mongoose.disconnect();
        console.log('📴 Disconnected from MongoDB');
    }
}

// Ask for confirmation before running
console.log('\n⚠️  WARNING: This will update all author stats in the database!');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(async () => {
    await fixAuthorStats();
}, 3000);