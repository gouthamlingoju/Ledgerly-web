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
    Calculates interest based on full months (30 days each) + remainder days.
    A full month is defined as the same date in the next month.
    """
    from dateutil.relativedelta import relativedelta
    
    if evaluation_date <= cycle_start_date:
        return Decimal('0.00')

    total_equivalent_days = 0
    temp_date = cycle_start_date
    
    # Count full months as 30 days each
    while True:
        next_month = temp_date + relativedelta(months=1)
        if next_month <= evaluation_date:
            total_equivalent_days += 30
            temp_date = next_month
        else:
            break
            
    # Add remaining days
    remainder_days = (evaluation_date - temp_date).days
    total_equivalent_days += remainder_days
        
    accrued = daily_interest * Decimal(str(total_equivalent_days))
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
