export default function MenuItem({ dish, average, onSelectDish }) {
    const ratingText = average == null ? "평가 없음" : `★ ${average.toFixed(1)}`;
    const dishDetails = (
        <>
            <span>{dish.name}</span>
            <span className="campus-menu-rating">{ratingText}</span>
        </>
    );

    return (
        <li>
            {onSelectDish ? (
                <button type="button" className="campus-menu-item" onClick={() => onSelectDish(dish)}>
                    {dishDetails}
                </button>
            ) : (
                <div className="campus-menu-item">{dishDetails}</div>
            )}
        </li>
    );
}
