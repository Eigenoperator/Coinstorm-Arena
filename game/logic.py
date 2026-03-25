from __future__ import annotations

import random
from dataclasses import dataclass, field

from game.entities import Coin, Enemy, Player, Vector2


def rectangles_overlap(
    left_a: float,
    top_a: float,
    width_a: float,
    height_a: float,
    left_b: float,
    top_b: float,
    width_b: float,
    height_b: float,
) -> bool:
    return (
        left_a < left_b + width_b
        and left_a + width_a > left_b
        and top_a < top_b + height_b
        and top_a + height_a > top_b
    )


@dataclass
class GameState:
    width: int = 800
    height: int = 600
    spawn_interval: float = 0.85
    shield_duration: float = 2.0
    dash_distance: float = 110.0
    coin_spawn_interval: float = 3.0
    max_coins: int = 3
    player: Player = field(
        default_factory=lambda: Player(
            position=Vector2(380.0, 520.0),
            width=32,
            height=32,
            speed=260.0,
        )
    )
    enemies: list[Enemy] = field(default_factory=list)
    coins: list[Coin] = field(default_factory=list)
    score: int = 0
    skill_charges: int = 0
    charge_progress: int = 0
    elapsed_time: float = 0.0
    spawn_timer: float = 0.0
    coin_spawn_timer: float = 0.0
    game_over: bool = False
    rng: random.Random = field(default_factory=random.Random)

    def move_player(self, dx: float, dy: float, dt: float) -> None:
        if self.game_over:
            return

        self.player.position.x += dx * self.player.speed * dt
        self.player.position.y += dy * self.player.speed * dt
        self.clamp_player()

    def clamp_player(self) -> None:
        self.player.position.x = max(
            0.0, min(self.player.position.x, self.width - self.player.width)
        )
        self.player.position.y = max(
            0.0, min(self.player.position.y, self.height - self.player.height)
        )

    def activate_dash(self, dx: float, dy: float) -> bool:
        if self.game_over or self.skill_charges <= 0:
            return False
        if dx == 0 and dy == 0:
            return False

        self.player.position.x += dx * self.dash_distance
        self.player.position.y += dy * self.dash_distance
        self.clamp_player()
        self.skill_charges -= 1
        return True

    def activate_shield(self) -> bool:
        if self.game_over or self.skill_charges <= 0 or self.player.shield_timer > 0:
            return False

        self.player.shield_timer = self.shield_duration
        self.skill_charges -= 1
        return True

    def spawn_enemy(self) -> Enemy:
        enemy_template = self.rng.choices(
            population=[
                ("scout", (18, 28), (280.0, 380.0), "#f59e0b", 2),
                ("brute", (44, 64), (140.0, 220.0), "#ef4444", 3),
                ("drifter", (28, 40), (200.0, 280.0), "#60a5fa", 1),
            ],
            weights=[0.4, 0.25, 0.35],
            k=1,
        )[0]
        enemy_kind, size_range, speed_range, enemy_color, score_value = enemy_template
        enemy_width = self.rng.randint(size_range[0], size_range[1])
        enemy_height = self.rng.randint(size_range[0], size_range[1])
        travel_speed = self.rng.uniform(speed_range[0], speed_range[1])
        direction = self.rng.choice(("top", "bottom", "left", "right"))

        if direction == "top":
            enemy_x = self.rng.uniform(0, self.width - enemy_width)
            enemy_y = -enemy_height
            velocity_x = self.rng.uniform(-70.0, 70.0)
            velocity_y = travel_speed
        elif direction == "bottom":
            enemy_x = self.rng.uniform(0, self.width - enemy_width)
            enemy_y = self.height
            velocity_x = self.rng.uniform(-70.0, 70.0)
            velocity_y = -travel_speed
        elif direction == "left":
            enemy_x = -enemy_width
            enemy_y = self.rng.uniform(0, self.height - enemy_height)
            velocity_x = travel_speed
            velocity_y = self.rng.uniform(-70.0, 70.0)
        else:
            enemy_x = self.width
            enemy_y = self.rng.uniform(0, self.height - enemy_height)
            velocity_x = -travel_speed
            velocity_y = self.rng.uniform(-70.0, 70.0)

        enemy = Enemy(
            position=Vector2(enemy_x, enemy_y),
            width=enemy_width,
            height=enemy_height,
            velocity_x=velocity_x,
            velocity_y=velocity_y,
            kind=enemy_kind,
            color=enemy_color,
            score_value=score_value,
        )
        self.enemies.append(enemy)
        return enemy

    def spawn_coin(self) -> Coin | None:
        if len(self.coins) >= self.max_coins:
            return None

        coin = Coin(
            position=Vector2(
                self.rng.uniform(20, self.width - 34),
                self.rng.uniform(20, self.height - 34),
            )
        )
        self.coins.append(coin)
        return coin

    def add_points(self, points: int) -> None:
        self.score += points
        self.charge_progress += points
        while self.charge_progress >= 10:
            self.charge_progress -= 10
            self.skill_charges += 1

    def enemy_out_of_bounds(self, enemy: Enemy) -> bool:
        return (
            enemy.position.x + enemy.width < -60
            or enemy.position.x > self.width + 60
            or enemy.position.y + enemy.height < -60
            or enemy.position.y > self.height + 60
        )

    def update(self, dt: float) -> None:
        if self.game_over:
            return

        self.elapsed_time += dt
        self.spawn_timer += dt
        self.coin_spawn_timer += dt
        self.player.shield_timer = max(0.0, self.player.shield_timer - dt)

        if self.spawn_timer >= self.spawn_interval:
            self.spawn_timer -= self.spawn_interval
            self.spawn_enemy()
        if self.coin_spawn_timer >= self.coin_spawn_interval:
            self.coin_spawn_timer -= self.coin_spawn_interval
            self.spawn_coin()

        remaining_enemies: list[Enemy] = []
        for enemy in self.enemies:
            enemy.position.x += enemy.velocity_x * dt
            enemy.position.y += enemy.velocity_y * dt

            if self.enemy_out_of_bounds(enemy):
                enemy.passed = True
                self.add_points(enemy.score_value)
                continue

            if rectangles_overlap(
                self.player.position.x,
                self.player.position.y,
                self.player.width,
                self.player.height,
                enemy.position.x,
                enemy.position.y,
                enemy.width,
                enemy.height,
            ):
                if self.player.shield_timer > 0:
                    continue
                self.game_over = True

            remaining_enemies.append(enemy)

        self.enemies = remaining_enemies

        remaining_coins: list[Coin] = []
        for coin in self.coins:
            if rectangles_overlap(
                self.player.position.x,
                self.player.position.y,
                self.player.width,
                self.player.height,
                coin.position.x,
                coin.position.y,
                coin.size,
                coin.size,
            ):
                self.add_points(coin.value)
                continue
            remaining_coins.append(coin)

        self.coins = remaining_coins

    def reset(self) -> None:
        self.player.position.x = (self.width - self.player.width) / 2
        self.player.position.y = self.height - self.player.height - 48
        self.enemies.clear()
        self.coins.clear()
        self.score = 0
        self.skill_charges = 0
        self.charge_progress = 0
        self.elapsed_time = 0.0
        self.spawn_timer = 0.0
        self.coin_spawn_timer = 0.0
        self.game_over = False
        self.player.shield_timer = 0.0
