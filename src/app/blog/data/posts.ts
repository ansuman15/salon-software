// Blog posts data - Anthropic-style clean design
export interface BlogPost {
    slug: string;
    title: string;
    excerpt: string;
    category: string;
    author: {
        name: string;
        avatar: string;
    };
    date: string;
    readTime: string;
    image?: string;
    featured?: boolean;
}

export const blogPosts: BlogPost[] = [
    {
        slug: "why-salon-software-essential-2024",
        title: "Why Salon Management Software is Essential in 2024",
        excerpt: "Discover how modern salon software can transform your business, from streamlined appointments to real-time analytics that drive growth.",
        category: "Industry Insights",
        author: { name: "Priya Sharma", avatar: "PS" },
        date: "2024-01-15",
        readTime: "5 min read",
        featured: true
    },
    {
        slug: "reduce-no-shows-whatsapp",
        title: "How to Reduce No-Shows by 60% with WhatsApp Reminders",
        excerpt: "Learn the proven strategies top salons use to minimize appointment no-shows and maximize their booking efficiency.",
        category: "Tips & Tricks",
        author: { name: "Rahul Verma", avatar: "RV" },
        date: "2024-01-10",
        readTime: "4 min read"
    },
    {
        slug: "staff-performance-tracking",
        title: "The Complete Guide to Staff Performance Tracking",
        excerpt: "Track, measure, and improve your team's performance with data-driven insights that help you make smarter business decisions.",
        category: "Management",
        author: { name: "Anjali Gupta", avatar: "AG" },
        date: "2024-01-05",
        readTime: "6 min read"
    },
    {
        slug: "customer-retention-strategies",
        title: "5 Customer Retention Strategies That Actually Work",
        excerpt: "Build lasting relationships with your clients using these proven retention tactics that keep them coming back.",
        category: "Growth",
        author: { name: "Vikram Singh", avatar: "VS" },
        date: "2024-01-02",
        readTime: "5 min read"
    },
    {
        slug: "inventory-management-salons",
        title: "Inventory Management Best Practices for Salons",
        excerpt: "Never run out of products again. Master the art of inventory tracking with these expert tips and tools.",
        category: "Operations",
        author: { name: "Meera Patel", avatar: "MP" },
        date: "2023-12-28",
        readTime: "4 min read"
    },
    {
        slug: "digital-payments-india",
        title: "Embracing Digital Payments: A Guide for Indian Salons",
        excerpt: "From UPI to card terminals, learn how to offer seamless payment experiences your customers will love.",
        category: "Payments",
        author: { name: "Arjun Mehta", avatar: "AM" },
        date: "2023-12-20",
        readTime: "5 min read"
    }
];

export const categories = [
    "All",
    "Industry Insights",
    "Tips & Tricks",
    "Management",
    "Growth",
    "Operations",
    "Payments"
];
