from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Vector2:
    x: float
    y: float


@dataclass
class Player:
    position: Vector2
    width: int
    height: int
    speed: float
    shield_timer: float = 0.0


@dataclass
class Enemy:
    position: Vector2
    width: int
    height: int
    velocity_x: float
    velocity_y: float
    kind: str
    color: str
    score_value: int
    passed: bool = False


@dataclass
class Coin:
    position: Vector2
    size: int = 14
    value: int = 1
