const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb://localhost:27017/inventory_manager';

const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    role: String,
    passwordHash: String
}, { collection: 'users' });

const User = mongoose.model('User', userSchema);

async function checkUsers() {
    try {
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('MongoDB connected');
        const users = await User.find({});
        console.log('Users found:', users);
        
        await mongoose.connection.close();
    } catch (error) {
        console.error('Error checking database:', error);
        process.exit(1);
    }
}

checkUsers(); 