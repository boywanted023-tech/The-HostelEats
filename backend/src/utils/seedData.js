const User = require('../models/User');
const Vendor = require('../models/Vendor');
const MenuItem = require('../models/MenuItem');
const DeliveryBoy = require('../models/DeliveryBoy');
const Order = require('../models/Order');
const AuditLog = require('../models/AuditLog');

const SAMPLE_MENUS = [
  { name: 'Masala Dosa',         description: 'Crispy dosa with potato masala', price: 60, preparationTime: 12, category: 'Breakfast', isVeg: true,  spiceLevel: 'Medium' },
  { name: 'Poha',                description: 'Maharashtrian flattened rice',  price: 40, preparationTime: 8,  category: 'Breakfast', isVeg: true,  spiceLevel: 'Mild' },
  { name: 'Aloo Paratha',        description: 'Stuffed paratha with butter',   price: 50, preparationTime: 10, category: 'Breakfast', isVeg: true,  spiceLevel: 'Medium' },
  { name: 'Veg Thali',           description: 'Complete meal with 4 items',    price: 120, preparationTime: 15, category: 'Lunch',     isVeg: true,  spiceLevel: 'Medium' },
  { name: 'Chicken Biryani',     description: 'Spicy Hyderabadi biryani',      price: 180, preparationTime: 20, category: 'Lunch',     isVeg: false, spiceLevel: 'Hot' },
  { name: 'Rajma Chawal',        description: 'Kidney beans curry with rice',  price: 110, preparationTime: 12, category: 'Lunch',     isVeg: true,  spiceLevel: 'Medium' },
  { name: 'Samosa',              description: 'Crispy triangle snack',         price: 15, preparationTime: 5,  category: 'Snacks',    isVeg: true,  spiceLevel: 'Medium' },
  { name: 'Vada Pav',            description: 'Mumbai street food',            price: 20, preparationTime: 6,  category: 'Snacks',    isVeg: true,  spiceLevel: 'Hot' },
  { name: 'French Fries',        description: 'Crispy salted fries',           price: 60, preparationTime: 8,  category: 'Snacks',    isVeg: true,  spiceLevel: 'Mild' },
  { name: 'Paneer Butter Masala',description: 'Creamy tomato gravy',           price: 160, preparationTime: 18, category: 'Dinner',    isVeg: true,  spiceLevel: 'Medium' },
  { name: 'Chicken Curry',       description: 'Spicy chicken curry',           price: 170, preparationTime: 18, category: 'Dinner',    isVeg: false, spiceLevel: 'Hot' },
  { name: 'Dal Makhani',         description: 'Creamy black lentils',          price: 140, preparationTime: 15, category: 'Dinner',    isVeg: true,  spiceLevel: 'Mild' },
  { name: 'Masala Chai',         description: 'Hot spiced tea',                price: 15, preparationTime: 3,  category: 'Beverages', isVeg: true,  spiceLevel: 'Mild' },
  { name: 'Cold Coffee',         description: 'Iced coffee with cream',        price: 80, preparationTime: 5,  category: 'Beverages', isVeg: true,  spiceLevel: 'Mild' },
  { name: 'Mango Lassi',         description: 'Sweet yogurt drink',            price: 60, preparationTime: 4,  category: 'Beverages', isVeg: true,  spiceLevel: 'Mild' }
];

const SAMPLE_VENDORS = [
  { shopName: 'Spice Junction',     description: 'Authentic Indian cuisine',         hostelBlock: 'A', openingTime: '08:00', closingTime: '23:00' },
  { shopName: 'Dosa Corner',        description: 'South Indian breakfast specialists', hostelBlock: 'B', openingTime: '07:00', closingTime: '22:00' },
  { shopName: 'Mumbai Chaat',       description: 'Street food favorites',            hostelBlock: 'C', openingTime: '10:00', closingTime: '22:00' },
  { shopName: 'Biryani House',      description: 'Hyderabadi biryani and more',      hostelBlock: 'D', openingTime: '11:00', closingTime: '23:30' },
  { shopName: 'Healthy Bowl',       description: 'Healthy meals and smoothies',      hostelBlock: 'E', openingTime: '08:00', closingTime: '21:00' }
];

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Ready', 'Picked', 'Delivered', 'Cancelled'];

const seedDatabase = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      console.log('Database already seeded, skipping');
      return;
    }

    console.log('Seeding database...');

    const admin = await User.create({
      name: 'Admin',
      email: process.env.ADMIN_EMAIL || 'admin@hosteleats.com',
      password: process.env.ADMIN_PASSWORD || 'SuperSecure@2024!',
      phone: '9999999999',
      role: 'admin',
      isVerified: true
    });
    console.log(`Admin: ${admin.email}`);

    const vendorUsers = [];
    for (const v of SAMPLE_VENDORS) {
      const u = await User.create({
        name: v.shopName + ' Owner',
        email: `${v.shopName.toLowerCase().replace(/\s+/g, '')}@hosteleats.com`,
        password: 'Vendor@123',
        phone: '98' + Math.floor(10000000 + Math.random() * 90000000),
        role: 'vendor',
        isVerified: true
      });
      const vendor = await Vendor.create({
        userId: u._id,
        ...v,
        isApproved: true,
        rating: 4.2 + Math.random() * 0.7
      });
      vendorUsers.push({ user: u, vendor });

      const sampleItems = SAMPLE_MENUS.sort(() => 0.5 - Math.random()).slice(0, 8);
      for (const item of sampleItems) {
        await MenuItem.create({ ...item, vendorId: vendor._id });
      }
    }

    for (let i = 1; i <= 3; i++) {
      const u = await User.create({
        name: `Delivery Boy ${i}`,
        email: `delivery${i}@hosteleats.com`,
        password: 'Delivery@123',
        phone: '97' + Math.floor(10000000 + Math.random() * 90000000),
        role: 'delivery',
        isVerified: true
      });
      await DeliveryBoy.create({
        userId: u._id,
        vehicleType: ['Bicycle', 'Scooter', 'Walking'][i - 1],
        rating: 4.3 + Math.random() * 0.6,
        isAvailable: true
      });
    }

    const customers = [];
    for (let i = 1; i <= 10; i++) {
      const u = await User.create({
        name: `Customer ${i}`,
        email: `customer${i}@hosteleats.com`,
        password: 'Customer@123',
        phone: '96' + Math.floor(10000000 + Math.random() * 90000000),
        role: 'customer',
        isVerified: true
      });
      customers.push(u);
    }

    for (let i = 0; i < 20; i++) {
      const customer = customers[Math.floor(Math.random() * customers.length)];
      const vendorEntry = vendorUsers[Math.floor(Math.random() * vendorUsers.length)];
      const items = await MenuItem.aggregate([
        { $match: { vendorId: vendorEntry.vendor._id } },
        { $sample: { size: Math.floor(Math.random() * 3) + 1 } }
      ]);

      if (!items.length) continue;

      const orderItems = items.map(menu => ({
        menuItemId: menu._id,
        name: menu.name,
        quantity: Math.floor(Math.random() * 3) + 1,
        price: menu.price,
        total: menu.price * (Math.floor(Math.random() * 3) + 1)
      }));
      const subtotal = orderItems.reduce((s, i) => s + i.total, 0);
      const status = ORDER_STATUSES[Math.floor(Math.random() * ORDER_STATUSES.length)];
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30) * 86400000);

      await Order.create({
        customerId: customer._id,
        vendorId: vendorEntry.vendor._id,
        items: orderItems,
        subtotal,
        deliveryCharge: 20,
        totalAmount: subtotal + 20,
        paymentMethod: ['COD', 'UPI', 'Online'][Math.floor(Math.random() * 3)],
        paymentStatus: status === 'Delivered' ? 'Paid' : 'Pending',
        deliveryAddress: {
          block: vendorEntry.vendor.hostelBlock,
          floor: String(Math.floor(Math.random() * 5) + 1),
          roomNumber: String(100 + Math.floor(Math.random() * 200)),
          landmark: ''
        },
        status,
        createdAt,
        updatedAt: createdAt
      });
    }

    console.log('Database seeded successfully');
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

module.exports = { seedDatabase };