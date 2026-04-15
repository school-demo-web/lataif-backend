require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Import models
const User = require("../models/User");
const Category = require("../models/Category");
const Article = require("../models/Article");

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB for seeding");
    
    // Clear existing data
    await User.deleteMany({});
    await Category.deleteMany({});
    await Article.deleteMany({});
    console.log("Cleared existing data");
    
    // Create admin user
    const admin = await User.create({
      name: "shaban",
      email: "mshaban0121@gmail.com",
      password: "Admin@123",
      role: "admin",
      bio: "Lataif-e-Adab کے چیف ایڈیٹر اور بانی۔ اردو ادب اور صحافت سے 15 سالہ وابستگی۔",
      avatar: "https://via.placeholder.com/150"
    });
    console.log("Created admin user");
    
    // Create authors
    const authors = await User.insertMany([
      {
        name: "ڈاکٹر احمد ندیم",
        email: "ahmed@editorialflow.com",
        password: "Author@123",
        role: "author",
        bio: "ماہرِ تعلیم، کالم نگار اور سماجی مسائل پر گہری نظر رکھنے والے مصنف۔",
        avatar: "https://via.placeholder.com/150",
        totalArticles: 24
      },
      {
        name: "سارہ اقبال",
        email: "sara@editorialflow.com",
        password: "Author@123",
        role: "author",
        bio: "ٹیکنالوجی اور ڈیجیٹل میڈیا کی ماہر۔ جدید ٹیکنالوجی کے سماجی اثرات پر تحقیق۔",
        avatar: "https://via.placeholder.com/150",
        totalArticles: 15
      },
      {
        name: "سید منور حسن",
        email: "munawwar@editorialflow.com",
        password: "Author@123",
        role: "author",
        bio: "سیاسی تجزیہ کار اور کالم نگار۔ 20 سالہ صحافتی تجربہ۔",
        avatar: "https://via.placeholder.com/150",
        totalArticles: 18
      }
    ]);
    console.log("Created authors");
    
    // Create categories
    const categories = await Category.insertMany([
      {
        name: "ادب",
        nameEn: "Literature",
        description: "اردو ادب، شاعری اور تنقید",
        color: "#00464a",
        icon: "book"
      },
      {
        name: "سیاست",
        nameEn: "Politics",
        description: "سیاسی تجزیے اور حالات حاضرہ",
        color: "#ba1a1a",
        icon: "gavel"
      },
      {
        name: "ٹیکنالوجی",
        nameEn: "Technology",
        description: "جدید ٹیکنالوجی اور ڈیجیٹل دنیا",
        color: "#14696d",
        icon: "devices"
      },
      {
        name: "ثقافت",
        nameEn: "Culture",
        description: "ثقافتی موضوعات اور سماجی رجحانات",
        color: "#62330f",
        icon: "theater_comedy"
      },
      {
        name: "بین الاقوامی",
        nameEn: "International",
        description: "عالمی خبریں اور بین الاقوامی امور",
        color: "#4c616c",
        icon: "public"
      }
    ]);
    console.log("Created categories");
    
    // Create sample articles
    const articles = await Article.insertMany([
      {
        title: "جدید اردو افسانے میں سماجی حقیقت نگاری کے نئے پہلو",
        content: "اردو ادب کی تاریخ ہمیشہ سے معاشرتی تغیر و تبدل کی عکاس رہی ہے...",
        excerpt: "اردو ادب کی تاریخ ہمیشہ سے معاشرتی تغیر و تبدل کی عکاس رہی ہے۔ آج کے دور میں افسانہ نگار کس طرح بدلتے ہوئے انسانی رویوں کو قرطاس پر منتقل کر رہے ہیں...",
        author: authors[0]._id,
        category: categories[0]._id,
        status: "published",
        views: 1250,
        tags: ["اردو ادب", "افسانہ", "تنقید"],
        publishedAt: new Date("2023-10-12")
      },
      {
        title: "مصنوعی ذہانت اور مستقبل کا تعلیمی ڈھانچہ",
        content: "کیا ٹیکنالوجی اساتذہ کی جگہ لے سکتی ہے؟...",
        excerpt: "کیا ٹیکنالوجی اساتذہ کی جگہ لے سکتی ہے؟ ڈیجیٹل دور میں سیکھنے اور سکھانے کے عمل میں آنے والی انقلابی تبدیلیوں کا ایک جائزہ...",
        author: authors[1]._id,
        category: categories[2]._id,
        status: "published",
        views: 980,
        tags: ["مصنوعی ذہانت", "تعلیم", "ٹیکنالوجی"],
        publishedAt: new Date("2023-10-08")
      },
      {
        title: "خطے کی بدلتی ہوئی سیاسی صورتحال اور  بھارت",
        content: "عالمی طاقتوں کے درمیان بڑھتی ہوئی کشیدگی...",
        excerpt: "عالمی طاقتوں کے درمیان بڑھتی ہوئی کشیدگی اور معاشی چیلنجز کے سائے میں  بھارت کی خارجہ پالیسی کے اہم خد و خال...",
        author: authors[2]._id,
        category: categories[1]._id,
        status: "published",
        views: 1500,
        tags: ["سیاست", " بھارت", "خارجہ پالیسی"],
        publishedAt: new Date("2023-10-05")
      }
    ]);
    console.log("Created sample articles");
    
    // Update category article counts
    for (const article of articles) {
      await Category.findByIdAndUpdate(article.category, {
        $inc: { articleCount: 1 }
      });
    }
    
    console.log("✅ Database seeded successfully!");
    console.log("📧 Admin Login: admin@editorialflow.com / Admin@123");
    console.log("📧 Author Login: ahmed@editorialflow.com / Author@123");
    
    process.exit(0);
  } catch (error) {
    console.error("Seeding error:", error);
    process.exit(1);
  }
};

seedDatabase();
