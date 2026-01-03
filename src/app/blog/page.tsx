"use client";

import { useState } from "react";
import Link from "next/link";
import { blogPosts, categories } from "./data/posts";
import styles from "./page.module.css";

export default function BlogPage() {
    const [selectedCategory, setSelectedCategory] = useState("All");

    const filteredPosts = selectedCategory === "All"
        ? blogPosts
        : blogPosts.filter(post => post.category === selectedCategory);

    const featuredPost = blogPosts.find(post => post.featured);

    return (
        <div className={styles.blogPage}>
            {/* Navigation */}
            <nav className={styles.nav}>
                <div className={styles.navContainer}>
                    <Link href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>S</span>
                        <span className={styles.logoText}>SalonX</span>
                    </Link>
                    <div className={styles.navLinks}>
                        <Link href="/#features">Features</Link>
                        <Link href="/#pricing">Pricing</Link>
                        <Link href="/blog" className={styles.active}>Blog</Link>
                    </div>
                    <Link href="/login" className={styles.ctaBtn}>Get Started</Link>
                </div>
            </nav>

            {/* Header */}
            <header className={styles.header}>
                <h1>Blog</h1>
                <p>Insights, tips, and best practices for modern salon management</p>
            </header>

            {/* Categories */}
            <div className={styles.categories}>
                {categories.map(category => (
                    <button
                        key={category}
                        className={`${styles.categoryBtn} ${selectedCategory === category ? styles.active : ""}`}
                        onClick={() => setSelectedCategory(category)}
                    >
                        {category}
                    </button>
                ))}
            </div>

            {/* Featured Post */}
            {featuredPost && selectedCategory === "All" && (
                <Link href={`/blog/${featuredPost.slug}`} className={styles.featuredPost}>
                    <div className={styles.featuredContent}>
                        <span className={styles.featuredBadge}>Featured</span>
                        <h2>{featuredPost.title}</h2>
                        <p>{featuredPost.excerpt}</p>
                        <div className={styles.postMeta}>
                            <div className={styles.author}>
                                <span className={styles.avatar}>{featuredPost.author.avatar}</span>
                                <span>{featuredPost.author.name}</span>
                            </div>
                            <span className={styles.dot}>•</span>
                            <span>{featuredPost.readTime}</span>
                        </div>
                    </div>
                    <div className={styles.featuredImage}>
                        <div className={styles.placeholderImage}>
                            <span>📊</span>
                        </div>
                    </div>
                </Link>
            )}

            {/* Posts Grid */}
            <div className={styles.postsGrid}>
                {filteredPosts.filter(p => !p.featured || selectedCategory !== "All").map(post => (
                    <Link href={`/blog/${post.slug}`} key={post.slug} className={styles.postCard}>
                        <div className={styles.postImage}>
                            <div className={styles.placeholderImage}>
                                <span>📝</span>
                            </div>
                        </div>
                        <div className={styles.postContent}>
                            <span className={styles.category}>{post.category}</span>
                            <h3>{post.title}</h3>
                            <p>{post.excerpt}</p>
                            <div className={styles.postMeta}>
                                <div className={styles.author}>
                                    <span className={styles.avatar}>{post.author.avatar}</span>
                                    <span>{post.author.name}</span>
                                </div>
                                <span className={styles.dot}>•</span>
                                <span>{post.readTime}</span>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Footer */}
            <footer className={styles.footer}>
                <p>© 2024 SalonX. All rights reserved.</p>
                <Link href="/">Back to Home</Link>
            </footer>
        </div>
    );
}
