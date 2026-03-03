from datetime import date
from decimal import Decimal, ROUND_HALF_UP

def calculate_daily_interest(current_principal: Decimal, monthly_interest_rate_pct: Decimal) -> Decimal:
    """
    daily_interest = (current_principal * interest_rate) / 30
    Assuming rate is passed as a percentage (e.g., 5 for 5%), so actual rate is rate/100.
    """
    # Convert percentage to decimal
    rate_decimal = monthly_interest_rate_pct / Decimal('100')
    
    # daily_interest
    daily_interest = (current_principal * rate_decimal) / Decimal('30')
    return daily_interest.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def calculate_accrued_interest(daily_interest: Decimal, cycle_start_date: date, evaluation_date: date) -> Decimal:
    """
    accrued_interest = daily_interest * days_elapsed
    days_elapsed = today - cycle_start_date
    """
    days_elapsed = (evaluation_date - cycle_start_date).days
    
    if days_elapsed <= 0:
        return Decimal('0.00')
        
    accrued = daily_interest * Decimal(str(days_elapsed))
    return accrued.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)

def compute_interest_snapshot(current_principal: Decimal, monthly_interest_rate_pct: Decimal, cycle_start_date: date, evaluation_date: date) -> dict:
    """
    Returns daily and total accrued interest.
    """
    daily = calculate_daily_interest(current_principal, monthly_interest_rate_pct)
    accrued = calculate_accrued_interest(daily, cycle_start_date, evaluation_date)
    return {
        "daily_interest": daily,
        "accrued_interest": accrued,
        "days_elapsed": max(0, (evaluation_date - cycle_start_date).days)
    }
