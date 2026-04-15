require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const User = require('../models/User');
const Article = require('../models/Article');
const Category = require('../models/Category');
const Comment = require('../models/Comment');

async function backup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const backup = {
            timestamp: new Date().toISOString(),
            users: await User.find({}).lean(),
            articles: await Article.find({}).lean(),
            categories: await Category.find({}).lean(),
            comments: await Comment.find({}).lean()
        };
        
        const timestamp = Date.now();
        const backupPath = path.join(__dirname, '..', 'backups', 'backup-' + timestamp + '.json');
        
        // Create backups folder if it doesn't exist
        const backupsDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupsDir)) {
            fs.mkdirSync(backupsDir, { recursive: true });
        }
        
        fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
        
        console.log('✅ Backup created: ' + backupPath);
        console.log('   📊 Users: ' + backup.users.length);
        console.log('   📊 Articles: ' + backup.articles.length);
        console.log('   📊 Categories: ' + backup.categories.length);
        console.log('   📊 Comments: ' + backup.comments.length);
        
    } catch (error) {
        console.error('❌ Backup failed:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

backup();
