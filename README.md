# Coinstorm Arena

A simple 2D Python arcade survival game built with `tkinter`.

## Play Online

- Live demo: https://eigenoperator.github.io/Coinstorm-Arena/
- Web source: [`docs/`](/home/xincheng/code/test/docs)

## Browser Features

- Start menu with pilot-name sign-in for each browser session
- Pause and resume support in the web build
- Persistent best score tracking per player in browser storage
- Static leaderboard stored in local browser storage for GitHub Pages deployments

## How to play

- Move with `WASD` or the arrow keys.
- Dodge enemies entering from all sides.
- Collect yellow coins to gain points.
- Every 10 points gives you 1 skill charge.
- Press `Space` to dash and `F` to activate a shield. Each skill use costs 1 charge.

## Run

```bash
python3 main.py
```

## Test

```bash
python3 -m unittest discover -s tests -v
```
