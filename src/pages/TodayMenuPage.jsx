import { useEffect, useState } from "react";
import CafeteriaSection from "../components/campusMenu/CafeteriaSection";
import { fetchMenu, todayInKorea } from "../components/campusMenu/menuApi";
import "../components/campusMenu/style.css";

const RANKING_WINDOW_MS = 30 * 60 * 1000;
const RANKING_LIMIT = 5;

function addRating(summaries, dishId, rating) {
    if (!summaries.has(dishId)) {
        summaries.set(dishId, { total: 0, count: 0 });
    }

    const summary = summaries.get(dishId);
    summary.total += rating;
    summary.count += 1;
}

function getRatingSummaries(reviews, now) {
    const allRatings = new Map();
    const recentRatings = new Map();
    const windowStart = now - RANKING_WINDOW_MS;

    for (const review of reviews) {
        const { dishId, rating, createdAt } = review;
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) continue;

        addRating(allRatings, dishId, rating);

        // Review timestamps can be milliseconds or ISO date strings.
        const reviewTime = typeof createdAt === "number" ? createdAt : Date.parse(createdAt);
        if (reviewTime > windowStart && reviewTime <= now) {
            addRating(recentRatings, dishId, rating);
        }
    }

    return { allRatings, recentRatings };
}

function getTopDishes(cafeterias, recentRatings) {
    const sections = cafeterias.flatMap((cafeteria) => cafeteria.sections);
    const dishes = sections.flatMap((section) => section.options.flat());
    const rankedDishes = [];
    const seenDishIds = new Set();

    for (const dish of dishes) {
        const rating = recentRatings.get(dish.dishId);
        if (!rating || seenDishIds.has(dish.dishId)) continue;

        seenDishIds.add(dish.dishId);
        rankedDishes.push({
            dish,
            average: rating.total / rating.count,
            count: rating.count,
        });
    }

    // Break ties by putting the dish with more recent reviews first.
    rankedDishes.sort((first, second) => {
        if (first.average !== second.average) return second.average - first.average;
        return second.count - first.count;
    });

    return rankedDishes.slice(0, RANKING_LIMIT);
}

export default function TodayMenuPage({ reviews = [], onSelectDish }) {
    const [date] = useState(todayInKorea);
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState(null);
    const [now, setNow] = useState(Date.now);

    useEffect(() => {
        if (!reviews.length) return;

        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [reviews.length]);

    useEffect(() => {
        const controller = new AbortController();

        async function loadMenu() {
            try {
                const cafeterias = await fetchMenu(date, controller.signal);
                if (!controller.signal.aborted) setResult({ cafeterias });
            } catch {
                if (!controller.signal.aborted) setResult({ failed: true });
            }
        }

        loadMenu();
        return () => controller.abort();
    }, [date, attempt]);

    const { allRatings, recentRatings } = getRatingSummaries(reviews, now);
    const topDishes = getTopDishes(result?.cafeterias ?? [], recentRatings);

    function retry() {
        setResult(null);
        setAttempt((previous) => previous + 1);
    }

    return (
        <section className="campus-menu" lang="ko" aria-labelledby="campus-menu-title">
            <header className="campus-menu-heading">
                <h1 id="campus-menu-title">오늘의 메뉴</h1>
                <time dateTime={date}>{date}</time>
            </header>
            {!result && <p role="status">식단을 불러오는 중입니다…</p>}
            {result?.failed && (
                <div>
                    <p role="alert">식단을 불러오지 못했습니다.</p>
                    <button type="button" onClick={retry}>다시 시도</button>
                </div>
            )}
            {result?.cafeterias && (
                <>
                    <section className="campus-menu-ranking" aria-labelledby="campus-menu-ranking-title">
                        <h2 id="campus-menu-ranking-title">최근 30분 인기 메뉴 TOP 5</h2>
                        {topDishes.length === 0 ? (
                            <p>최근 30분 동안 등록된 평가가 없습니다.</p>
                        ) : (
                            <ol className="campus-menu-ranking-list" tabIndex={0}>
                                {topDishes.map(({ dish, average }) => (
                                    <li key={dish.dishId}>
                                        <span>{dish.name}</span>
                                        <small>{dish.cafeteria} · ★ {average.toFixed(1)}</small>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </section>
                    <div className="campus-menu-grid">
                        {result.cafeterias.map((cafeteria) => (
                            <CafeteriaSection
                                key={cafeteria.key}
                                cafeteria={cafeteria}
                                ratingSummaries={allRatings}
                                onSelectDish={onSelectDish}
                            />
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}
