import MenuItem from "./MenuItem";

export default function CafeteriaSection({ cafeteria, ratingSummaries, onSelectDish }) {
    return (
        <article className="campus-menu-card">
            <h2>{cafeteria.name}</h2>
            {!cafeteria.sections.length && <p>오늘 등록된 메뉴가 없습니다.</p>}
            {cafeteria.sections.map(({ sourceRow, label, options }) => (
                <section key={sourceRow}>
                    <h3>{label}</h3>
                    {options.map((dishes, optionIndex) => (
                        <div key={optionIndex}>
                            {optionIndex > 0 && <p className="campus-menu-option">또는</p>}
                            <ul>
                                {dishes.map((dish, dishIndex) => {
                                    const rating = ratingSummaries.get(dish.dishId);
                                    const average = rating ? rating.total / rating.count : null;

                                    return (
                                        <MenuItem
                                            key={`${dish.dishId}-${dishIndex}`}
                                            dish={dish}
                                            average={average}
                                            onSelectDish={onSelectDish}
                                        />
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </section>
            ))}
        </article>
    );
}
