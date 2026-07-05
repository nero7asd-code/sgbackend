// =====================
// ENV / DEPENDÊNCIAS
// =====================
require("dotenv").config();
const express = require("express");
const path = require("path");

// =====================
// UTILS
// =====================
const Console = require("./ConsoleUtils");
const CryptoUtils = require("./CryptoUtils");
const SharedUtils = require("./SharedUtils");

const {
  BackendUtils,
  UserModel,
  UserController,
  RoundController,
  BattlePassController,
  EconomyController,
  AnalyticsController,
  FriendsController,
  NewsController,
  MissionsController,
  TournamentXController,
  MatchmakingController,
  TournamentController,
  SocialController,
  EventsController,
  authenticate,
  errorControll,
  sendShared,
  OnlineCheck,
  VerifyPhoton
} = require("./BackendUtils");

// =====================
// APP
// =====================
const app = express();
app.use(express.json());

// =====================
// CONFIG
// =====================
const TITLE = "Stumble World " + (process.env.VERSION || "dev");
const PORT = process.env.PORT || 3000;

// =====================
// ROTAS PÚBLICAS
// =====================
app.get("/api/v1/ping", (req, res) => {
  res.status(200).send("OK");
});

app.post("/photon/auth", VerifyPhoton);
app.get("/onlinecheck", OnlineCheck);

// =====================
// AUTH GLOBAL
// =====================
app.use(authenticate);

// =====================
// CONTROLLER LOCAL
// =====================
class CrownController {
  static async updateScore(req, res) {
    try {
      const { deviceid, username } = req.body;
      if (!deviceid || !username) {
        return res.status(400).json({ error: "Missing fields" });
      }
      const user = await UserModel.findByDeviceId(deviceid);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const newCrowns = (user.crowns || 0) + 1;
      await UserModel.update(user.stumbleId, { crowns: newCrowns });
      res.json({ success: true, crowns: newCrowns });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async list(req, res) {
    try {
      const { country = "", start = 0, count = 50 } = req.query;
      const data = await UserModel.GetHighscore("crowns", country, Number(start), Number(count));
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

// =====================
// ROTAS PRINCIPAIS
// =====================
app.get("/matchmaking/filter", MatchmakingController.getMatchmakingFilter);
app.post("/user/login", UserController.login);
app.get("/user/config", sendShared);
app.get("/usersettings", UserController.getSettings);
app.post("/user/updateusername", UserController.updateUsername);
app.get("/user/deleteaccount", UserController.deleteAccount);
app.post("/user/linkplatform", UserController.linkPlatform);
app.post("/user/unlinkplatform", UserController.unlinkPlatform);
app.get("/shared/:version/:type", sendShared);
app.post("/user/profile", UserController.getProfile);
app.post("/user-equipped-cosmetics/update", UserController.updateCosmetics);
app.post("/user/cosmetics/addskin", UserController.addSkin);
app.post("/user/cosmetics/setequipped", UserController.setEquippedCosmetic);

app.get("/round/finish/:round", RoundController.finishRound);
app.post("/round/finish/v4/:round", RoundController.finishRoundV4);
app.post("/round/eventfinish/v4/:round", RoundController.finishRoundV4);

app.get("/battlepass", BattlePassController.getBattlePass);
app.post("/battlepass/claimv3", BattlePassController.claimReward);
app.post("/battlepass/purchase", BattlePassController.purchaseBattlePass);
app.post("/battlepass/complete", BattlePassController.completeBattlePass);

app.get("/economy/purchase/:item", EconomyController.purchase);
app.get("/economy/purchasegasha/:itemId/:count", EconomyController.purchaseGasha);
app.get("/economy/purchaseluckyspin", EconomyController.purchaseLuckySpin);
app.post("/economy/:currencyType/give/:amount", EconomyController.giveCurrency);

app.get("/missions", MissionsController.getMissions);
app.post("/missions/:missionId/rewards/claim/v2", MissionsController.claimMissionReward);
app.post("/missions/objective/:objectiveId/:milestoneId/rewards/claim/v2", MissionsController.claimMilestoneReward);

app.post("/friends/request", FriendsController.request);
app.post("/friends/accept", FriendsController.accept);
app.post("/friends/request/decline", FriendsController.reject);
app.post("/friends/cancel", FriendsController.cancel);
app.get("/friends", FriendsController.list);
app.get("/friends/request", FriendsController.pending);
app.delete("/friends/:UserId", FriendsController.remove);

app.get("/game-events/me", EventsController.getActive);
app.get("/news/getall", NewsController.GetNews);
app.post("/analytics", AnalyticsController.analytic);

app.post("/update-crown-score", CrownController.updateScore);
app.get("/highscore/crowns/list", CrownController.list);

app.get("/social/interactions", SocialController.getInteractions);

app.get("/tournamentx/active", TournamentXController.getActive.bind(TournamentXController));
app.get("/tournamentx/active/v2", TournamentXController.getActive.bind(TournamentXController));
app.post("/tournamentx/:tournamentId/join/v2", TournamentXController.join.bind(TournamentXController));
app.post("/tournamentx/:tournamentId/leave", TournamentXController.leave.bind(TournamentXController));
app.post("/tournamentx/:tournamentId/finish", TournamentXController.finish.bind(TournamentXController));

app.post("/api/v1/userLoginExternal", TournamentController.login);
app.get("/api/v1/tournaments", TournamentController.getActive);

// =====================
// ROTAS PARA O BOT DO DISCORD
// =====================

// Atualizar username (mantido, mas melhorado)
app.post("/user/update-username", async (req, res) => {
  try {
    const { userId, username, color } = req.body;
    if (!userId || !username) return res.json({ success: false, message: "Faltam dados" });

    const user = await UserModel.findById(userId) || await UserModel.findByDeviceId(userId);
    if (!user) return res.json({ success: false, message: "Usuário não encontrado" });

    const updateData = { username };

    // Se veio cor, salva também
    if (color) {
      updateData.nameColor = color;        // ← Campo importante
      // updateData.tagColor = color;      // Se preferir usar tagColor
    }

    await UserModel.update(user.stumbleId || user.deviceId, updateData);
    res.json({ success: true, username, color });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Erro interno" });
  }
});

// ==================== NOVO ENDPOINT ====================
app.post("/user/add-tag", async (req, res) => {
  try {
    const { userId, tag, color, duration } = req.body; // duration em horas

    if (!userId || !tag) {
      return res.json({ success: false, message: "Faltam dados (userId e tag são obrigatórios)" });
    }

    const user = await UserModel.findById(userId) || await UserModel.findByDeviceId(userId);
    if (!user) return res.json({ success: false, message: "Usuário não encontrado" });

    const updateData = {
      username: `Player ${tag}`,     // ou só o tag, depende do seu gosto
      nameColor: color || "#FFFFFF",
      // tagColor: color || "#FFFFFF", // descomente se seu jogo usar tagColor
    };

    // Se quiser controlar duração (temporário), pode salvar data de expiração:
    if (duration) {
      const expiresAt = new Date(Date.now() + duration * 60 * 60 * 1000);
      updateData.tagExpiresAt = expiresAt;
      // Depois você pode criar uma lógica para remover tag automática
    }

    await UserModel.update(user.stumbleId || user.deviceId, updateData);

    res.json({ 
      success: true, 
      message: `Tag ${tag} aplicada com sucesso`,
      color: color 
    });
  } catch (err) {
    console.error(err);
    res.json({ success: false, message: "Erro interno" });
  }
});

// =====================
// ERROR HANDLER
// =====================
app.use(errorControll);

// =====================
// START
// =====================
app.listen(PORT, () => {
  const now = new Date().toLocaleString().replace(",", " |");
  console.clear();
  Console.log("Server", `[${TITLE}] | ${now} | ${CryptoUtils.SessionToken()}`);
  Console.log("Server", `Listening on port ${PORT}`);
});
