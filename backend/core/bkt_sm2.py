# ─── Helper: Pelacakan Kognitif BKT (Bayesian Knowledge Tracing) ───
def update_bkt(current_mastery: float, is_correct: bool) -> float:
    p_learn = 0.20
    p_guess = 0.25
    p_slip = 0.10

    if is_correct:
        numerator = current_mastery * (1 - p_slip)
        denominator = numerator + (1 - current_mastery) * p_guess
    else:
        numerator = current_mastery * p_slip
        denominator = numerator + (1 - current_mastery) * (1 - p_guess)

    p_known_given_obs = numerator / (denominator if denominator > 0 else 1)
    new_mastery = p_known_given_obs + (1 - p_known_given_obs) * p_learn
    return max(0.01, min(0.99, new_mastery))

# ─── Helper: Penjadwalan Spaced Repetition (SM-2 Algorithm) ───
def update_sm2(card_state: dict, rating: int) -> dict:
    interval = card_state.get("interval", 1)
    ease_factor = card_state.get("ease_factor", 2.5)
    repetitions = card_state.get("repetitions", 0)

    if rating >= 3:
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = int(interval * ease_factor)
        repetitions += 1
    else:
        repetitions = 0
        interval = 1

    q_map = {1: 1, 2: 3, 3: 4, 4: 5}
    q = q_map.get(rating, 4)
    ease_factor = ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    ease_factor = max(1.3, ease_factor)

    return {"interval": interval, "ease_factor": ease_factor, "repetitions": repetitions}
