import Link from "next/link";
import { notFound } from "next/navigation";
import { blogPosts } from "../data/posts";
import styles from "./page.module.css";

interface Props {
    params: { slug: string };
}

export function generateStaticParams() {
    return blogPosts.map((post) => ({
        slug: post.slug,
    }));
}

export default function BlogPostPage({ params }: Props) {
    const post = blogPosts.find((p) => p.slug === params.slug);

    if (!post) {
        notFound();
    }

    const relatedPosts = blogPosts
        .filter((p) => p.slug !== post.slug && p.category === post.category)
        .slice(0, 2);

    return (
        <div className={styles.postPage}>
            {/* Navigation */}
            <nav className={styles.nav}>
                <div className={styles.navContainer}>
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>S</span>
                        <span className={styles.logoText}>SalonX</span>
                    </Link>
                    <Link href="/blog" className={styles.backLink}>
                        ← Back to Blog
                    </Link>
                </div>
            </nav>

            {/* Article Header */}
            <header className={styles.articleHeader}>
                <span className={styles.category}>{post.category}</span>
                <h1>{post.title}</h1>
                <div className={styles.meta}>
                    <div className={styles.author}>
                        <span className={styles.avatar}>{post.author.avatar}</span>
                        <span>{post.author.name}</span>
                    </div>
                    <span className={styles.dot}>•</span>
                    <span>{new Date(post.date).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    })}</span>
                    <span className={styles.dot}>•</span>
                    <span>{post.readTime}</span>
                </div>
            </header>

            {/* Article Content */}
            <article className={styles.article}>
                <p className={styles.lead}>{post.excerpt}</p>

                <h2>Introduction</h2>
                <p>
                    In today's fast-paced world, managing a salon efficiently requires more than just talent and hard work.
                    Modern salon owners need smart tools that help them focus on what matters most — delivering exceptional
                    customer experiences while growing their business sustainably.
                </p>

                <h2>Key Takeaways</h2>
                <ul>
                    <li>Streamlined operations lead to happier customers and staff</li>
                    <li>Data-driven decisions help identify growth opportunities</li>
                    <li>Automation reduces manual errors and saves valuable time</li>
                    <li>Customer insights enable personalized service delivery</li>
                </ul>

                <h2>The Bottom Line</h2>
                <p>
                    Whether you're running a small neighborhood salon or managing multiple branches,
                    the right tools can make all the difference. Start with the basics — appointment
                    management and customer tracking — and gradually expand your digital toolkit as
                    your business grows.
                </p>

                <div className={styles.cta}>
                    <h3>Ready to transform your salon?</h3>
                    <p>Join thousands of salons already using SalonX to streamline their operations.</p>
                    <Link href="/#pricing" className={styles.ctaBtn}>Get Started Free</Link>
                </div>
            </article>

            {/* Related Posts */}
            {relatedPosts.length > 0 && (
                <section className={styles.related}>
                    <h2>Related Articles</h2>
                    <div className={styles.relatedGrid}>
                        {relatedPosts.map((rp) => (
                            <Link href={`/blog/${rp.slug}`} key={rp.slug} className={styles.relatedCard}>
                                <span className={styles.relatedCategory}>{rp.category}</span>
                                <h3>{rp.title}</h3>
                                <span className={styles.readTime}>{rp.readTime}</span>
                            </Link>
                        ))}
                    </div>
                </section>
            )}

            {/* Footer */}
            <footer className={styles.footer}>
                <p>© 2024 SalonX. All rights reserved.</p>
                <div className={styles.footerLinks}>
                    <Link href="/">Home</Link>
                    <Link href="/blog">Blog</Link>
                </div>
            </footer>
        </div>
    );
}
