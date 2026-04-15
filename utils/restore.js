require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');

const User = require('../models/User');
const Article = require('../models/Article');
const Category = require('../models/Category');
const Comment = require('../models/Comment');

async function restore() {
    try {
        const backupFile = process.argv[2];
        
        if (!backupFile) {
            console.error('Usage: node utils/restore.js <backup-file.json>');
            process.exit(1);
        }
        
        if (!fs.existsSync(backupFile)) {
            console.error('❌ File not found: ' + backupFile);
            process.exit(1);
        }
        
        const backup = JSON.parse(fs.readFileSync(backupFile, 'utf8'));
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        // Clear existing data
        console.log('⚠️ Clearing existing data...');
        await User.deleteMany({});
        await Article.deleteMany({});
        await Category.deleteMany({});
        await Comment.deleteMany({});
        
        // Restore
        if (backup.users && backup.users.length) {
            await User.insertMany(backup.users);
            console.log('✅ Restored ' + backup.users.length + ' users');
        }
        if (backup.categories && backup.categories.length) {
            await Category.insertMany(backup.categories);
            console.log('✅ Restored ' + backup.categories.length + ' categories');
        }
        if (backup.articles && backup.articles.length) {
            await Article.insertMany(backup.articles);
            console.log('✅ Restored ' + backup.articles.length + ' articles');
        }
        if (backup.comments && backup.comments.length) {
            await Comment.insertMany(backup.comments);
            console.log('✅ Restored ' + backup.comments.length + ' comments');
        }
        
        console.log('\n🎉 Restore complete!');
        
    } catch (error) {
        console.error('❌ Restore failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

restore();
