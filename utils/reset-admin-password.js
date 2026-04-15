require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');

async function resetAdminPassword() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');
        
        const adminEmail = 'admin@blog.com';
        const newPassword = 'Swbon28122005@5'; // Change this to your desired password
        
        // Find admin user
        let admin = await User.findOne({ email: adminEmail });
        
        if (!admin) {
            console.log('❌ Admin user not found!');
            console.log('Creating new admin user...');
            
            admin = await User.create({
                name: 'Admin',
                email: adminEmail,
                password: newPassword,
                role: 'admin',
                status: 'approved'
            });
            console.log('✅ Admin user created!');
        } else {
            // Directly set the password hash (bypassing pre-save hook)
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(newPassword, salt);
            
            await User.updateOne(
                { _id: admin._id },
                { $set: { password: hashedPassword } }
            );
            console.log('✅ Password updated!');
        }
        
        console.log('\n📋 Login Credentials:');
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Password: ${newPassword}`);
        console.log('\n🔐 You can now login at: https://lataif-e-adab.vercel.app/login');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

resetAdminPassword();