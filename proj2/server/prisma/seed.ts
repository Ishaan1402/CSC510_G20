import { OrderStatus, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const hash = (plain: string) => bcrypt.hash(plain, 10);

async function main() {
  await prisma.menuItemChangeLog.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.menuSection.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  const password = await hash("password123!");

  const customer = await prisma.user.create({
    data: {
      name: "Casey Customer",
      email: "customer@example.com",
      role: UserRole.CUSTOMER,
      passwordHash: password,
    },
  });

  const merchantOne = await prisma.user.create({
    data: {
      name: "Riley Diner",
      email: "merchant1@example.com",
      role: UserRole.RESTAURANT,
      passwordHash: password,
    },
  });

  const merchantTwo = await prisma.user.create({
    data: {
      name: "Taylor Bistro",
      email: "merchant2@example.com",
      role: UserRole.RESTAURANT,
      passwordHash: password,
    },
  });

  const merchantThree = await prisma.user.create({
    data: {
      name: "Alex Quick Bites",
      email: "merchant3@example.com",
      role: UserRole.RESTAURANT,
      passwordHash: password,
    },
  });

  // Additional merchants for I-95 route demo
  const merchantFour = await prisma.user.create({
    data: {
      name: "Richmond Roadside Diner",
      email: "merchant4@example.com",
      role: UserRole.RESTAURANT,
      passwordHash: password,
    },
  });

  const merchantFive = await prisma.user.create({
    data: {
      name: "DC Express Eats",
      email: "merchant5@example.com",
      role: UserRole.RESTAURANT,
      passwordHash: password,
    },
  });

  const merchantSix = await prisma.user.create({
    data: {
      name: "Baltimore Harbor Grill",
      email: "merchant6@example.com",
      role: UserRole.RESTAURANT,
      passwordHash: password,
    },
  });

  const merchantSeven = await prisma.user.create({
    data: {
      name: "Philly Quick Stop",
      email: "merchant7@example.com",
      role: UserRole.RESTAURANT,
      passwordHash: password,
    },
  });

  const merchantEight = await prisma.user.create({
    data: {
      name: "NYC Metro Bistro",
      email: "merchant8@example.com",
      role: UserRole.RESTAURANT,
      passwordHash: password,
    },
  });

  const createRestaurant = async (
    ownerId: string,
    name: string,
    address: string,
    latitude: number,
    longitude: number,
    isFastService: boolean = false,
    isLocalFavorite: boolean = false,
    dietaryTags: { vegetarian?: boolean; vegan?: boolean } = {},
    priceLevel: "BUDGET" | "MID" | "UPSCALE" = "MID",
  ) => {
    const restaurant = await prisma.restaurant.create({
      data: {
        ownerUserId: ownerId,
        name,
        address,
        latitude,
        longitude,
        isFastService,
        isLocalFavorite,
        priceLevel,
      },
    });

    const breakfast = await prisma.menuSection.create({
      data: {
        restaurantId: restaurant.id,
        title: "Breakfast",
        position: 0,
      },
    });

    const lunch = await prisma.menuSection.create({
      data: {
        restaurantId: restaurant.id,
        title: "Lunch",
        position: 1,
      },
    });

    // Build tags based on dietary requirements
    const breakfastTags: string[] = [];
    const lunchTags: string[] = [];
    if (dietaryTags.vegetarian) {
      breakfastTags.push("vegetarian");
      lunchTags.push("vegetarian");
    }
    if (dietaryTags.vegan) {
      breakfastTags.push("vegan");
      lunchTags.push("vegan");
    }

    await prisma.menuItem.createMany({
      data: [
        {
          restaurantId: restaurant.id,
          sectionId: breakfast.id,
          name: "Sunrise Burrito",
          description: "Egg, cheese, potatoes, and salsa wrap.",
          priceCents: 899,
          tags: breakfastTags.length > 0 ? [...breakfastTags] : ["vegetarian"],
        },
        {
          restaurantId: restaurant.id,
          sectionId: breakfast.id,
          name: "Blueberry Pancakes",
          description: "Stack of fluffy pancakes with maple syrup.",
          priceCents: 1099,
          tags: breakfastTags.length > 0 ? [...breakfastTags, "sweet"] : ["sweet"],
        },
        {
          restaurantId: restaurant.id,
          sectionId: lunch.id,
          name: "Roasted Veggie Bowl",
          description: "Seasonal vegetables over quinoa and greens.",
          priceCents: 1299,
          tags: lunchTags.length > 0 ? [...lunchTags, "gluten-free"] : ["vegan", "gluten-free"],
        },
        {
          restaurantId: restaurant.id,
          sectionId: lunch.id,
          name: "Grilled Chicken Sandwich",
          description: "Herb marinated chicken breast with aioli.",
          priceCents: 1199,
          tags: ["popular"],
        },
        {
          restaurantId: restaurant.id,
          name: "House Lemonade",
          description: "Fresh squeezed lemons with mint.",
          priceCents: 399,
          tags: lunchTags.length > 0 ? [...lunchTags, "drink"] : ["drink"],
        },
        {
          restaurantId: restaurant.id,
          name: "Chocolate Chip Cookie",
          description: "Baked in-house every morning.",
          priceCents: 249,
          tags: breakfastTags.length > 0 ? [...breakfastTags, "dessert"] : ["dessert"],
        },
      ],
    });

    return restaurant;
  };

  const [restaurantOne, restaurantTwo, restaurantThree, restaurantFour, restaurantFive, restaurantSix, restaurantSeven, restaurantEight] = await Promise.all([
    // Original local restaurants
    createRestaurant(
      merchantOne.id,
      "RouteDash Fuel Kitchen",
      "123 Main St, Durham NC",
      35.994,
      -78.898,
      false, // isFastService
      true,  // isLocalFavorite
      { vegetarian: true }, // Has vegetarian options
      "BUDGET", // Price level
    ),
    createRestaurant(
      merchantTwo.id,
      "RouteDash Eats Lab",
      "500 Hillsborough St, Raleigh NC",
      35.787,
      -78.647,
      true,  // isFastService
      false, // isLocalFavorite
      { vegan: true }, // Has vegan options
      "MID", // Price level
    ),
    createRestaurant(
      merchantThree.id,
      "RouteDash Express",
      "789 Franklin St, Chapel Hill NC",
      35.913,
      -79.055,
      true,  // isFastService
      true,  // isLocalFavorite
      { vegetarian: true, vegan: true }, // Has both vegetarian and vegan options
      "MID", // Price level
    ),
    // I-95 Route restaurants (Raleigh to New York)
    // Richmond, VA area (I-95)
    createRestaurant(
      merchantFour.id,
      "Richmond Roadside Diner",
      "2500 W Broad St, Richmond VA 23220",
      37.548,
      -77.476,
      true,  // isFastService
      true,  // isLocalFavorite
      { vegetarian: true }, // Has vegetarian options
      "BUDGET", // Price level
    ),
    // Washington DC area (I-95)
    createRestaurant(
      merchantFive.id,
      "DC Express Eats",
      "1200 Maryland Ave SW, Washington DC 20024",
      38.886,
      -77.019,
      true,  // isFastService
      false, // isLocalFavorite
      { vegan: true }, // Has vegan options
      "MID", // Price level
    ),
    // Baltimore, MD area (I-95)
    createRestaurant(
      merchantSix.id,
      "Baltimore Harbor Grill",
      "200 E Pratt St, Baltimore MD 21202",
      39.286,
      -76.612,
      false, // isFastService
      true,  // isLocalFavorite
      { vegetarian: true, vegan: true }, // Has both
      "UPSCALE", // Price level
    ),
    // Philadelphia, PA area (I-95)
    createRestaurant(
      merchantSeven.id,
      "Philly Quick Stop",
      "1500 Market St, Philadelphia PA 19102",
      39.953,
      -75.165,
      true,  // isFastService
      false, // isLocalFavorite
      { vegetarian: true }, // Has vegetarian options
      "BUDGET", // Price level
    ),
    // New York, NY area (I-95)
    createRestaurant(
      merchantEight.id,
      "NYC Metro Bistro",
      "350 5th Ave, New York NY 10118",
      40.748,
      -73.985,
      false, // isFastService
      true,  // isLocalFavorite
      { vegetarian: true, vegan: true }, // Has both
      "UPSCALE", // Price level
    ),
  ]);

  const restaurantOneItems = await prisma.menuItem.findMany({
    where: { restaurantId: restaurantOne.id },
    orderBy: { name: "asc" },
  });

  const restaurantTwoItems = await prisma.menuItem.findMany({
    where: { restaurantId: restaurantTwo.id },
    orderBy: { name: "asc" },
  });

  const pendingOrderItems = restaurantOneItems.slice(0, 2).map((item, index) => ({
    menuItemId: item.id,
    quantity: index === 0 ? 1 : 2,
    priceCents: item.priceCents,
  }));
  const pendingOrderTotal = pendingOrderItems.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );

  await prisma.order.create({
    data: {
      customerId: customer.id,
      restaurantId: restaurantOne.id,
      status: OrderStatus.PENDING,
      pickupEtaMin: 15,
      routeOrigin: "Raleigh, NC",
      routeDestination: "Durham, NC",
      totalCents: pendingOrderTotal,
      items: {
        create: pendingOrderItems,
      },
    },
  });

  const processingOrderItems = restaurantOneItems.slice(2, 4).map((item) => ({
    menuItemId: item.id,
    quantity: 1,
    priceCents: item.priceCents,
  }));
  const processingOrderTotal = processingOrderItems.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );

  await prisma.order.create({
    data: {
      customerId: customer.id,
      restaurantId: restaurantOne.id,
      status: OrderStatus.PREPARING,
      pickupEtaMin: 10,
      routeOrigin: "Cary, NC",
      routeDestination: "Durham, NC",
      totalCents: processingOrderTotal,
      items: {
        create: processingOrderItems,
      },
    },
  });

  const readyOrderItems = restaurantTwoItems.slice(0, 2).map((item) => ({
    menuItemId: item.id,
    quantity: 1,
    priceCents: item.priceCents,
  }));
  const readyOrderTotal = readyOrderItems.reduce(
    (sum, item) => sum + item.priceCents * item.quantity,
    0,
  );

  await prisma.order.create({
    data: {
      customerId: customer.id,
      restaurantId: restaurantTwo.id,
      status: OrderStatus.READY,
      pickupEtaMin: 5,
      routeOrigin: "Chapel Hill, NC",
      routeDestination: "Raleigh, NC",
      totalCents: readyOrderTotal,
      items: {
        create: readyOrderItems,
      },
    },
  });

  console.log("Seed complete:", {
    customer: customer.email,
    merchants: [
      merchantOne.email,
      merchantTwo.email,
      merchantThree.email,
      merchantFour.email,
      merchantFive.email,
      merchantSix.email,
      merchantSeven.email,
      merchantEight.email,
    ],
    restaurants: 8,
    route: "Raleigh, NC to New York, NY (I-95)",
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
