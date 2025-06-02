import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const dgn_ovs = {
    data: ['eventType=achievement_completed',
    'eventType=generic',
    'eventType=start_session',
    'eventType=apple_connect',
    'eventType=install',
    'eventType=totals_mini_game',
    'eventType=bingo',
    'eventType=kochava',
    'eventType=tournament',
    'eventType=cashier',
    'eventType=level_up',
    'eventType=transaction',
    'eventType=collect_bonus',
    'eventType=mission',
    'eventType=unlock_slot',
    'eventType=counter_event',
    'eventType=monetization_offer',
    'eventType=uplifting_deals',
    'eventType=counter_status',
    'eventType=new_tournament',
    'eventType=user_details',
    'eventType=end_session',
    'eventType=error',
    'eventType=popup',
    'eventType=vegas_stories',
    'eventType=facebook_connect',
    'eventType=scripted_win',
    'eventType=vip_direct_line_message',
    'eventType=favorites_slots',
    'eventType=singular',
    'eventType=worlds',
    'eventType=flow'
    ],
    tape_number: '000004',
    space_left: '1.9T'
}

const dgn_lts_1 = {
    data: ['eventType=adoptive_product',
    'eventType=inbox',
    'eventType=request_gift',
    'eventType=ads',
    'eventType=install',
    'eventType=roc',
    'eventType=apple_connect',
    'eventType=invite',
    'eventType=send_gift',
    'eventType=apple_disconnect',
    'eventType=lucky_loot',
    'eventType=send_notification',
    'eventType=back_to_lobby',
    'eventType=lucky_rush_challenge_status',
    'eventType=share',
    'eventType=bonus_game',
    'eventType=lucky_stories',
    'eventType=singular',
    'eventType=cashier',
    'eventType=mini_game_dice_moves',
    'eventType=spin_counter',
    'eventType=challenge_collect',
    'eventType=mission',
    'eventType=stop',
    'eventType=collect_bonus',
    'eventType=monetization_offer',
    'eventType=swrve',
    'eventType=counter_completed',
    'eventType=monetization_offer_imp',
    'eventType=tournament',
    'eventType=counter_completed2',
    'eventType=my_room',
    'eventType=tournament_participants',
    'eventType=counter_status',
    'eventType=open_slot',
    'eventType=transaction',
    'eventType=crown_connect',
    'eventType=optimove_campaign_applied',
    'eventType=tutorial',
    'eventType=dim_economy_scheme',
    'eventType=optimove_campaign_status',
    'eventType=uninstall',
    'eventType=end_session',
    'eventType=piggy_bank',
    'eventType=uplifting_deals',
    'eventType=facebook_connect',
    'eventType=popup',
    'eventType=urbanairship',
    'eventType=facebook_disconnect',
    'eventType=popup_offer',
    'eventType=urban_air_ship',
    'eventType=favorite_slot',
    'eventType=feature_impressions',
    'eventType=rate_us',
    'eventType=user_details',
    'eventType=high_roller_room',
    'eventType=recommendation',
    'eventType=user_profile_view'
    ],
    tape_number: '000006',
    space_left: '422G',
}

const dgn_lts_2 = {
    data: ['_delta_log',
        'eventType=kochava',
        'eventType=lucky_rush',
        'eventType=spin',
        '_SUCCESS',
        'eventType=collectible_spin',
        'eventType=level_up',
        'eventType=slot_load',
        'eventType=start_session'
    ],
    tape_number: '000007',
    space_left: '0G'
}

const migrateData = async () => {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'admin@123',
    database: process.env.MYSQL_DATABASE || 'user_management_system',
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306
  });

  try {
    // Process dgn_ovs data
    for (const fileName of dgn_ovs.data) {
      await connection.execute(
        `INSERT INTO upload_details 
          (user_name, group_name, file_name, file_size, status, method, tape_location, tape_number, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          'ShivangGupta',
          'dgn_ovs',
          fileName,
          'unknown',
          'completed',
          'server19',
          `/home/octro/tapedata1/${fileName}`,
          dgn_ovs.tape_number
        ]
      );
    }

    // Process dgn_lts_1 data
    for (const fileName of dgn_lts_1.data) {
      await connection.execute(
        `INSERT INTO upload_details 
          (user_name, group_name, file_name, file_size, status, method, tape_location, tape_number, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          'ShivangGupta',
          'dgn_lts',
          fileName,
          'unknown',
          'completed',
          'server19',
          `/home/octro/tapedata1/${fileName}`,
          dgn_lts_1.tape_number
        ]
      );
    }

    // Process dgn_lts_2 data
    for (const fileName of dgn_lts_2.data) {
      await connection.execute(
        `INSERT INTO upload_details 
          (user_name, group_name, file_name, file_size, status, method, tape_location, tape_number, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          'ShivangGupta',
          'dgn_lts',
          fileName,
          'unknown',
          'completed',
          'server19',
          `/home/octro/tapedata1/${fileName}`,
          dgn_lts_2.tape_number
        ]
      );
    }

    console.log('✅ Data migration completed successfully');
    console.log(`Processed ${dgn_ovs.data.length + dgn_lts_1.data.length + dgn_lts_2.data.length} records`);

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await connection.end();
  }
};

migrateData().catch(console.error);

