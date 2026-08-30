import random

def quick_pick():
    whites = sorted(random.sample(range(1, 70), 5))
    powerball = random.randint(1, 26)
    return whites, powerball

if __name__ == "__main__":
    for i in range(5):
        whites, pb = quick_pick()
        nums = " - ".join(f"{n:02d}" for n in whites)
        print(f"Set {i+1}: {nums}  |  Powerball: {pb:02d}")
