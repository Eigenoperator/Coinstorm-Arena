import random
import unittest

from game.logic import GameState, rectangles_overlap


class RectanglesOverlapTests(unittest.TestCase):
    def test_overlap_returns_true_for_intersection(self) -> None:
        self.assertTrue(rectangles_overlap(0, 0, 10, 10, 5, 5, 10, 10))

    def test_overlap_returns_false_for_separate_rectangles(self) -> None:
        self.assertFalse(rectangles_overlap(0, 0, 10, 10, 20, 20, 10, 10))


class GameStateTests(unittest.TestCase):
    def make_state(self) -> GameState:
        state = GameState(rng=random.Random(7))
        state.reset()
        return state

    def test_player_movement_stays_inside_world_bounds(self) -> None:
        state = self.make_state()
        state.move_player(-10, -10, 1.0)
        self.assertEqual(state.player.position.x, 0.0)
        self.assertEqual(state.player.position.y, 0.0)

        state.move_player(10, 10, 10.0)
        self.assertEqual(state.player.position.x, state.width - state.player.width)
        self.assertEqual(state.player.position.y, state.height - state.player.height)

    def test_enemy_spawns_within_horizontal_bounds(self) -> None:
        state = self.make_state()
        enemy = state.spawn_enemy()
        self.assertTrue(
            enemy.position.x <= state.width and enemy.position.x + enemy.width >= 0.0
        )
        self.assertTrue(
            enemy.position.y <= state.height and enemy.position.y + enemy.height >= 0.0
        )
        self.assertIn(enemy.kind, {"scout", "brute", "drifter"})
        self.assertIn(enemy.score_value, {1, 2, 3})

    def test_score_increases_when_enemy_exits_map(self) -> None:
        state = self.make_state()
        enemy = state.spawn_enemy()
        enemy.position.x = state.width + 100
        state.update(0.016)
        self.assertEqual(state.score, enemy.score_value)

    def test_collision_sets_game_over(self) -> None:
        state = self.make_state()
        enemy = state.spawn_enemy()
        enemy.position.x = state.player.position.x
        enemy.position.y = state.player.position.y
        enemy.width = state.player.width
        enemy.height = state.player.height
        state.update(0.016)
        self.assertTrue(state.game_over)

    def test_dash_moves_player_and_starts_cooldown(self) -> None:
        state = self.make_state()
        state.add_points(10)
        start_x = state.player.position.x
        used = state.activate_dash(1.0, 0.0)
        self.assertTrue(used)
        self.assertGreater(state.player.position.x, start_x)
        self.assertEqual(state.skill_charges, 0)

    def test_shield_prevents_one_collision_window(self) -> None:
        state = self.make_state()
        state.add_points(10)
        activated = state.activate_shield()
        self.assertTrue(activated)

        enemy = state.spawn_enemy()
        enemy.position.x = state.player.position.x
        enemy.position.y = state.player.position.y
        enemy.width = state.player.width
        enemy.height = state.player.height

        state.update(0.016)
        self.assertFalse(state.game_over)
        self.assertGreater(state.player.shield_timer, 0.0)

    def test_points_grant_skill_charge_every_ten_points(self) -> None:
        state = self.make_state()
        state.add_points(9)
        self.assertEqual(state.skill_charges, 0)
        state.add_points(1)
        self.assertEqual(state.skill_charges, 1)
        self.assertEqual(state.charge_progress, 0)

    def test_coin_collection_adds_points_and_removes_coin(self) -> None:
        state = self.make_state()
        coin = state.spawn_coin()
        self.assertIsNotNone(coin)
        assert coin is not None
        coin.position.x = state.player.position.x
        coin.position.y = state.player.position.y

        state.update(0.016)
        self.assertEqual(state.score, 1)
        self.assertEqual(len(state.coins), 0)


if __name__ == "__main__":
    unittest.main()
