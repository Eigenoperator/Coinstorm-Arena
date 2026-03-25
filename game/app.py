from __future__ import annotations

import time
import tkinter as tk

from game.logic import GameState


class GameApp:
    def __init__(self) -> None:
        self.game_name = "Coinstorm Arena"
        self.state = GameState()
        self.state.reset()
        self.root = tk.Tk()
        self.root.title(self.game_name)
        self.root.resizable(False, False)

        self.score_var = tk.StringVar(value="Score: 0")
        self.status_var = tk.StringVar(
            value="Move with arrow keys/WASD. Skills cost 1 charge. Gain 1 charge every 10 points."
        )
        self.skill_var = tk.StringVar(value="")

        header = tk.Frame(self.root, padx=10, pady=8)
        header.pack(fill="x")

        tk.Label(header, textvariable=self.score_var, font=("Helvetica", 14, "bold")).pack(
            side="left"
        )
        tk.Label(header, textvariable=self.status_var, font=("Helvetica", 11)).pack(
            side="right"
        )
        tk.Label(self.root, textvariable=self.skill_var, font=("Helvetica", 11)).pack(
            pady=(0, 6)
        )

        self.canvas = tk.Canvas(
            self.root,
            width=self.state.width,
            height=self.state.height,
            bg="#111827",
            highlightthickness=0,
        )
        self.canvas.pack()

        self.keys_pressed: set[str] = set()
        self.last_tick = time.perf_counter()

        self.root.bind("<KeyPress>", self.on_key_press)
        self.root.bind("<KeyRelease>", self.on_key_release)

    def on_key_press(self, event: tk.Event) -> None:
        key = event.keysym.lower()
        self.keys_pressed.add(key)
        if key == "r" and self.state.game_over:
            self.state.reset()
            self.status_var.set(
                "Move with arrow keys/WASD. Skills cost 1 charge. Gain 1 charge every 10 points."
            )
        elif key == "space":
            dx, dy = self.current_direction()
            if dx == 0 and dy == 0:
                dy = -1.0
            if self.state.activate_dash(dx, dy):
                self.status_var.set("Dash activated.")
            else:
                self.status_var.set("Need 1 skill charge to dash.")
        elif key == "f":
            if self.state.activate_shield():
                self.status_var.set("Shield activated.")
            else:
                self.status_var.set("Need 1 skill charge to shield.")

    def on_key_release(self, event: tk.Event) -> None:
        key = event.keysym.lower()
        self.keys_pressed.discard(key)

    def current_direction(self) -> tuple[float, float]:
        dx = 0.0
        dy = 0.0

        if "left" in self.keys_pressed or "a" in self.keys_pressed:
            dx -= 1.0
        if "right" in self.keys_pressed or "d" in self.keys_pressed:
            dx += 1.0
        if "up" in self.keys_pressed or "w" in self.keys_pressed:
            dy -= 1.0
        if "down" in self.keys_pressed or "s" in self.keys_pressed:
            dy += 1.0

        return dx, dy

    def draw(self) -> None:
        self.canvas.delete("all")

        self.canvas.create_text(
            self.state.width - 100,
            24,
            text=f"Enemies: {len(self.state.enemies)}  Coins: {len(self.state.coins)}",
            fill="#d1d5db",
            font=("Helvetica", 11),
        )

        player = self.state.player
        self.canvas.create_rectangle(
            player.position.x,
            player.position.y,
            player.position.x + player.width,
            player.position.y + player.height,
            fill="#34d399" if self.state.player.shield_timer == 0 else "#fde68a",
            outline="#fef3c7" if self.state.player.shield_timer > 0 else "",
            width=2 if self.state.player.shield_timer > 0 else 1,
        )

        for enemy in self.state.enemies:
            self.canvas.create_rectangle(
                enemy.position.x,
                enemy.position.y,
                enemy.position.x + enemy.width,
                enemy.position.y + enemy.height,
                fill=enemy.color,
                outline="",
            )

            self.canvas.create_text(
                enemy.position.x + enemy.width / 2,
                enemy.position.y - 8,
                text=enemy.kind,
                fill="#e5e7eb",
                font=("Helvetica", 8),
            )

        for coin in self.state.coins:
            self.canvas.create_oval(
                coin.position.x,
                coin.position.y,
                coin.position.x + coin.size,
                coin.position.y + coin.size,
                fill="#facc15",
                outline="#fde68a",
                width=2,
            )

        if self.state.game_over:
            self.canvas.create_rectangle(
                160, 220, 640, 360, fill="#030712", outline="#f9fafb", width=2
            )
            self.canvas.create_text(
                400,
                260,
                text="Game Over",
                fill="#f9fafb",
                font=("Helvetica", 28, "bold"),
            )
            self.canvas.create_text(
                400,
                300,
                text=f"Final score: {self.state.score}  |  Press R to restart",
                fill="#d1d5db",
                font=("Helvetica", 14),
            )

    def tick(self) -> None:
        now = time.perf_counter()
        dt = min(now - self.last_tick, 0.05)
        self.last_tick = now

        dx, dy = self.current_direction()
        self.state.move_player(dx, dy, dt)
        self.state.update(dt)

        self.score_var.set(f"Score: {self.state.score}")
        self.skill_var.set(
            f"Skill charges: {self.state.skill_charges} | Next charge in {10 - self.state.charge_progress} pts"
            + " | Shield: "
            + (
                f"active {self.state.player.shield_timer:.1f}s"
                if self.state.player.shield_timer > 0
                else "inactive"
            )
        )
        if self.state.game_over:
            self.status_var.set("You collided with an enemy.")

        self.draw()
        self.root.after(16, self.tick)

    def run(self) -> None:
        self.draw()
        self.root.after(16, self.tick)
        self.root.mainloop()
