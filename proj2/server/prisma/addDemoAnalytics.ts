import { OrderStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Get restaurants and customer
  const restaurants = await prisma.restaurant.findMany({
    include: {
      menuItems: true,
    },
    take: 3, // Add data to first 3 restaurants
  });

  const customer = await prisma.user.findFirst({
    where: { email: "customer@example.com" },
  });

  if (restaurants.length === 0 || !customer) {
    console.error("Restaurants or customer not found. Run seed first!");
    process.exit(1);
  }

  // Create orders for each restaurant
  const now = new Date();
  let totalOrdersCreated = 0;

  for (const restaurant of restaurants) {
    const menuItems = restaurant.menuItems;
    if (menuItems.length === 0) {
      console.log(`Skipping ${restaurant.name} - no menu items`);
      continue;
    }

    const orders: Array<{
    customerId: string;
    restaurantId: string;
    status: OrderStatus;
    pickupEtaMin: number;
    routeOrigin: string;
    routeDestination: string;
    totalCents: number;
    createdAt: Date;
    items: Array<{ menuItemId: string; quantity: number; priceCents: number }>;
  }> = [];

  // Generate orders for the last 30 days
  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);

    // Vary the number of orders per day (more on weekends)
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const ordersPerDay = isWeekend ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 4) + 1;

    for (let i = 0; i < ordersPerDay; i++) {
      // Peak hours: 11 AM - 2 PM (lunch) and 5 PM - 8 PM (dinner)
      let hour: number;
      if (Math.random() < 0.4) {
        // Lunch peak (11 AM - 2 PM)
        hour = 11 + Math.floor(Math.random() * 4);
      } else if (Math.random() < 0.7) {
        // Dinner peak (5 PM - 8 PM)
        hour = 17 + Math.floor(Math.random() * 4);
      } else {
        // Other hours
        hour = Math.floor(Math.random() * 24);
      }

      const orderDate = new Date(date);
      orderDate.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

      // Random menu items (1-4 items per order)
      const numItems = Math.floor(Math.random() * 4) + 1;
      const selectedItems = [];
      const usedIndices = new Set<number>();

      for (let j = 0; j < numItems; j++) {
        let itemIndex;
        do {
          itemIndex = Math.floor(Math.random() * menuItems.length);
        } while (usedIndices.has(itemIndex));
        usedIndices.add(itemIndex);

        const item = menuItems[itemIndex];
        const quantity = Math.floor(Math.random() * 3) + 1; // 1-3 quantity
        selectedItems.push({
          menuItemId: item.id,
          quantity,
          priceCents: item.priceCents,
        });
      }

      const subtotal = selectedItems.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
      const taxCents = Math.round(subtotal * 0.0825);
      const totalCents = subtotal + taxCents;

      // Mix of order statuses (mostly completed for analytics)
      const statuses: OrderStatus[] = [
        OrderStatus.COMPLETED,
        OrderStatus.COMPLETED,
        OrderStatus.COMPLETED,
        OrderStatus.COMPLETED,
        OrderStatus.COMPLETED,
        OrderStatus.READY,
        OrderStatus.PREPARING,
        OrderStatus.PENDING,
      ];
      const status = statuses[Math.floor(Math.random() * statuses.length)];

      orders.push({
        customerId: customer.id,
        restaurantId: restaurant.id,
        status,
        pickupEtaMin: Math.floor(Math.random() * 20) + 5,
        routeOrigin: ["Raleigh, NC", "Durham, NC", "Chapel Hill, NC", "Cary, NC"][
          Math.floor(Math.random() * 4)
        ],
        routeDestination: ["Durham, NC", "Raleigh, NC", "Chapel Hill, NC", "Cary, NC"][
          Math.floor(Math.random() * 4)
        ],
        totalCents,
        createdAt: orderDate,
        items: selectedItems,
      });
    }
  }

    // Create orders in batches
    console.log(`Creating ${orders.length} demo orders for ${restaurant.name}...`);

    for (const orderData of orders) {
      const { items, ...orderFields } = orderData;
      await prisma.order.create({
        data: {
          ...orderFields,
          items: {
            create: items,
          },
        },
      });
    }

    totalOrdersCreated += orders.length;

    // Calculate stats for this restaurant
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalCents, 0);
    const avgOrder = orders.length > 0 ? Math.round(totalRevenue / orders.length) : 0;

    console.log(`   ✅ ${restaurant.name}: ${orders.length} orders, $${(totalRevenue / 100).toFixed(2)} revenue`);
  }

  // Overall stats
  const allOrders = await prisma.order.findMany({
    where: { status: { not: "CANCELED" } },
  });
  const totalRevenue = allOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const avgOrder = allOrders.length > 0 ? Math.round(totalRevenue / allOrders.length) : 0;

  console.log("\n✅ Demo analytics data created!");
  console.log(`   Total Orders Created: ${totalOrdersCreated}`);
  console.log(`   Total Orders in DB: ${allOrders.length}`);
  console.log(`   Total Revenue: $${(totalRevenue / 100).toFixed(2)}`);
  console.log(`   Average Order: $${(avgOrder / 100).toFixed(2)}`);
  console.log(`   Date Range: Last 30 days`);
  console.log("\n📊 Analytics features to check:");
  console.log("   - Orders by Day (last 30 days)");
  console.log("   - Peak Ordering Hours");
  console.log("   - Most Popular Items");
  console.log("   - Total Revenue & Average Order Value");
  console.log("\n💡 Login as merchant1@example.com to see analytics!");
}

main()
  .catch((error) => {
    console.error("Error creating demo analytics:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

