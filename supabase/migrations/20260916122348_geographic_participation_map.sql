BEGIN;

-- Geography is voluntary. Existing submissions retain unknown geography and
-- their original consent/schema versions. No location is inferred or backfilled.
CREATE FUNCTION private.participation_country_name(p_code text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE SET search_path = ''
AS $country$
  SELECT CASE p_code
    WHEN 'AD' THEN 'Andorra'
    WHEN 'AE' THEN 'United Arab Emirates'
    WHEN 'AF' THEN 'Afghanistan'
    WHEN 'AG' THEN 'Antigua & Barbuda'
    WHEN 'AI' THEN 'Anguilla'
    WHEN 'AL' THEN 'Albania'
    WHEN 'AM' THEN 'Armenia'
    WHEN 'AO' THEN 'Angola'
    WHEN 'AQ' THEN 'Antarctica'
    WHEN 'AR' THEN 'Argentina'
    WHEN 'AS' THEN 'American Samoa'
    WHEN 'AT' THEN 'Austria'
    WHEN 'AU' THEN 'Australia'
    WHEN 'AW' THEN 'Aruba'
    WHEN 'AX' THEN 'Åland Islands'
    WHEN 'AZ' THEN 'Azerbaijan'
    WHEN 'BA' THEN 'Bosnia & Herzegovina'
    WHEN 'BB' THEN 'Barbados'
    WHEN 'BD' THEN 'Bangladesh'
    WHEN 'BE' THEN 'Belgium'
    WHEN 'BF' THEN 'Burkina Faso'
    WHEN 'BG' THEN 'Bulgaria'
    WHEN 'BH' THEN 'Bahrain'
    WHEN 'BI' THEN 'Burundi'
    WHEN 'BJ' THEN 'Benin'
    WHEN 'BL' THEN 'St. Barthélemy'
    WHEN 'BM' THEN 'Bermuda'
    WHEN 'BN' THEN 'Brunei'
    WHEN 'BO' THEN 'Bolivia'
    WHEN 'BQ' THEN 'Caribbean Netherlands'
    WHEN 'BR' THEN 'Brazil'
    WHEN 'BS' THEN 'Bahamas'
    WHEN 'BT' THEN 'Bhutan'
    WHEN 'BV' THEN 'Bouvet Island'
    WHEN 'BW' THEN 'Botswana'
    WHEN 'BY' THEN 'Belarus'
    WHEN 'BZ' THEN 'Belize'
    WHEN 'CA' THEN 'Canada'
    WHEN 'CC' THEN 'Cocos (Keeling) Islands'
    WHEN 'CD' THEN 'Congo - Kinshasa'
    WHEN 'CF' THEN 'Central African Republic'
    WHEN 'CG' THEN 'Congo - Brazzaville'
    WHEN 'CH' THEN 'Switzerland'
    WHEN 'CI' THEN 'Côte d’Ivoire'
    WHEN 'CK' THEN 'Cook Islands'
    WHEN 'CL' THEN 'Chile'
    WHEN 'CM' THEN 'Cameroon'
    WHEN 'CN' THEN 'China'
    WHEN 'CO' THEN 'Colombia'
    WHEN 'CR' THEN 'Costa Rica'
    WHEN 'CU' THEN 'Cuba'
    WHEN 'CV' THEN 'Cape Verde'
    WHEN 'CW' THEN 'Curaçao'
    WHEN 'CX' THEN 'Christmas Island'
    WHEN 'CY' THEN 'Cyprus'
    WHEN 'CZ' THEN 'Czechia'
    WHEN 'DE' THEN 'Germany'
    WHEN 'DJ' THEN 'Djibouti'
    WHEN 'DK' THEN 'Denmark'
    WHEN 'DM' THEN 'Dominica'
    WHEN 'DO' THEN 'Dominican Republic'
    WHEN 'DZ' THEN 'Algeria'
    WHEN 'EC' THEN 'Ecuador'
    WHEN 'EE' THEN 'Estonia'
    WHEN 'EG' THEN 'Egypt'
    WHEN 'EH' THEN 'Western Sahara'
    WHEN 'ER' THEN 'Eritrea'
    WHEN 'ES' THEN 'Spain'
    WHEN 'ET' THEN 'Ethiopia'
    WHEN 'FI' THEN 'Finland'
    WHEN 'FJ' THEN 'Fiji'
    WHEN 'FK' THEN 'Falkland Islands'
    WHEN 'FM' THEN 'Micronesia'
    WHEN 'FO' THEN 'Faroe Islands'
    WHEN 'FR' THEN 'France'
    WHEN 'GA' THEN 'Gabon'
    WHEN 'GB' THEN 'United Kingdom'
    WHEN 'GD' THEN 'Grenada'
    WHEN 'GE' THEN 'Georgia'
    WHEN 'GF' THEN 'French Guiana'
    WHEN 'GG' THEN 'Guernsey'
    WHEN 'GH' THEN 'Ghana'
    WHEN 'GI' THEN 'Gibraltar'
    WHEN 'GL' THEN 'Greenland'
    WHEN 'GM' THEN 'Gambia'
    WHEN 'GN' THEN 'Guinea'
    WHEN 'GP' THEN 'Guadeloupe'
    WHEN 'GQ' THEN 'Equatorial Guinea'
    WHEN 'GR' THEN 'Greece'
    WHEN 'GS' THEN 'South Georgia & South Sandwich Islands'
    WHEN 'GT' THEN 'Guatemala'
    WHEN 'GU' THEN 'Guam'
    WHEN 'GW' THEN 'Guinea-Bissau'
    WHEN 'GY' THEN 'Guyana'
    WHEN 'HK' THEN 'Hong Kong SAR China'
    WHEN 'HM' THEN 'Heard & McDonald Islands'
    WHEN 'HN' THEN 'Honduras'
    WHEN 'HR' THEN 'Croatia'
    WHEN 'HT' THEN 'Haiti'
    WHEN 'HU' THEN 'Hungary'
    WHEN 'ID' THEN 'Indonesia'
    WHEN 'IE' THEN 'Ireland'
    WHEN 'IL' THEN 'Israel'
    WHEN 'IM' THEN 'Isle of Man'
    WHEN 'IN' THEN 'India'
    WHEN 'IO' THEN 'British Indian Ocean Territory'
    WHEN 'IQ' THEN 'Iraq'
    WHEN 'IR' THEN 'Iran'
    WHEN 'IS' THEN 'Iceland'
    WHEN 'IT' THEN 'Italy'
    WHEN 'JE' THEN 'Jersey'
    WHEN 'JM' THEN 'Jamaica'
    WHEN 'JO' THEN 'Jordan'
    WHEN 'JP' THEN 'Japan'
    WHEN 'KE' THEN 'Kenya'
    WHEN 'KG' THEN 'Kyrgyzstan'
    WHEN 'KH' THEN 'Cambodia'
    WHEN 'KI' THEN 'Kiribati'
    WHEN 'KM' THEN 'Comoros'
    WHEN 'KN' THEN 'St. Kitts & Nevis'
    WHEN 'KP' THEN 'North Korea'
    WHEN 'KR' THEN 'South Korea'
    WHEN 'KW' THEN 'Kuwait'
    WHEN 'KY' THEN 'Cayman Islands'
    WHEN 'KZ' THEN 'Kazakhstan'
    WHEN 'LA' THEN 'Laos'
    WHEN 'LB' THEN 'Lebanon'
    WHEN 'LC' THEN 'St. Lucia'
    WHEN 'LI' THEN 'Liechtenstein'
    WHEN 'LK' THEN 'Sri Lanka'
    WHEN 'LR' THEN 'Liberia'
    WHEN 'LS' THEN 'Lesotho'
    WHEN 'LT' THEN 'Lithuania'
    WHEN 'LU' THEN 'Luxembourg'
    WHEN 'LV' THEN 'Latvia'
    WHEN 'LY' THEN 'Libya'
    WHEN 'MA' THEN 'Morocco'
    WHEN 'MC' THEN 'Monaco'
    WHEN 'MD' THEN 'Moldova'
    WHEN 'ME' THEN 'Montenegro'
    WHEN 'MF' THEN 'St. Martin'
    WHEN 'MG' THEN 'Madagascar'
    WHEN 'MH' THEN 'Marshall Islands'
    WHEN 'MK' THEN 'North Macedonia'
    WHEN 'ML' THEN 'Mali'
    WHEN 'MM' THEN 'Myanmar (Burma)'
    WHEN 'MN' THEN 'Mongolia'
    WHEN 'MO' THEN 'Macao SAR China'
    WHEN 'MP' THEN 'Northern Mariana Islands'
    WHEN 'MQ' THEN 'Martinique'
    WHEN 'MR' THEN 'Mauritania'
    WHEN 'MS' THEN 'Montserrat'
    WHEN 'MT' THEN 'Malta'
    WHEN 'MU' THEN 'Mauritius'
    WHEN 'MV' THEN 'Maldives'
    WHEN 'MW' THEN 'Malawi'
    WHEN 'MX' THEN 'Mexico'
    WHEN 'MY' THEN 'Malaysia'
    WHEN 'MZ' THEN 'Mozambique'
    WHEN 'NA' THEN 'Namibia'
    WHEN 'NC' THEN 'New Caledonia'
    WHEN 'NE' THEN 'Niger'
    WHEN 'NF' THEN 'Norfolk Island'
    WHEN 'NG' THEN 'Nigeria'
    WHEN 'NI' THEN 'Nicaragua'
    WHEN 'NL' THEN 'Netherlands'
    WHEN 'NO' THEN 'Norway'
    WHEN 'NP' THEN 'Nepal'
    WHEN 'NR' THEN 'Nauru'
    WHEN 'NU' THEN 'Niue'
    WHEN 'NZ' THEN 'New Zealand'
    WHEN 'OM' THEN 'Oman'
    WHEN 'PA' THEN 'Panama'
    WHEN 'PE' THEN 'Peru'
    WHEN 'PF' THEN 'French Polynesia'
    WHEN 'PG' THEN 'Papua New Guinea'
    WHEN 'PH' THEN 'Philippines'
    WHEN 'PK' THEN 'Pakistan'
    WHEN 'PL' THEN 'Poland'
    WHEN 'PM' THEN 'St. Pierre & Miquelon'
    WHEN 'PN' THEN 'Pitcairn Islands'
    WHEN 'PR' THEN 'Puerto Rico'
    WHEN 'PS' THEN 'Palestinian Territories'
    WHEN 'PT' THEN 'Portugal'
    WHEN 'PW' THEN 'Palau'
    WHEN 'PY' THEN 'Paraguay'
    WHEN 'QA' THEN 'Qatar'
    WHEN 'RE' THEN 'Réunion'
    WHEN 'RO' THEN 'Romania'
    WHEN 'RS' THEN 'Serbia'
    WHEN 'RU' THEN 'Russia'
    WHEN 'RW' THEN 'Rwanda'
    WHEN 'SA' THEN 'Saudi Arabia'
    WHEN 'SB' THEN 'Solomon Islands'
    WHEN 'SC' THEN 'Seychelles'
    WHEN 'SD' THEN 'Sudan'
    WHEN 'SE' THEN 'Sweden'
    WHEN 'SG' THEN 'Singapore'
    WHEN 'SH' THEN 'St. Helena'
    WHEN 'SI' THEN 'Slovenia'
    WHEN 'SJ' THEN 'Svalbard & Jan Mayen'
    WHEN 'SK' THEN 'Slovakia'
    WHEN 'SL' THEN 'Sierra Leone'
    WHEN 'SM' THEN 'San Marino'
    WHEN 'SN' THEN 'Senegal'
    WHEN 'SO' THEN 'Somalia'
    WHEN 'SR' THEN 'Suriname'
    WHEN 'SS' THEN 'South Sudan'
    WHEN 'ST' THEN 'São Tomé & Príncipe'
    WHEN 'SV' THEN 'El Salvador'
    WHEN 'SX' THEN 'Sint Maarten'
    WHEN 'SY' THEN 'Syria'
    WHEN 'SZ' THEN 'Eswatini'
    WHEN 'TC' THEN 'Turks & Caicos Islands'
    WHEN 'TD' THEN 'Chad'
    WHEN 'TF' THEN 'French Southern Territories'
    WHEN 'TG' THEN 'Togo'
    WHEN 'TH' THEN 'Thailand'
    WHEN 'TJ' THEN 'Tajikistan'
    WHEN 'TK' THEN 'Tokelau'
    WHEN 'TL' THEN 'Timor-Leste'
    WHEN 'TM' THEN 'Turkmenistan'
    WHEN 'TN' THEN 'Tunisia'
    WHEN 'TO' THEN 'Tonga'
    WHEN 'TR' THEN 'Türkiye'
    WHEN 'TT' THEN 'Trinidad & Tobago'
    WHEN 'TV' THEN 'Tuvalu'
    WHEN 'TW' THEN 'Taiwan'
    WHEN 'TZ' THEN 'Tanzania'
    WHEN 'UA' THEN 'Ukraine'
    WHEN 'UG' THEN 'Uganda'
    WHEN 'UM' THEN 'U.S. Outlying Islands'
    WHEN 'US' THEN 'United States'
    WHEN 'UY' THEN 'Uruguay'
    WHEN 'UZ' THEN 'Uzbekistan'
    WHEN 'VA' THEN 'Vatican City'
    WHEN 'VC' THEN 'St. Vincent & Grenadines'
    WHEN 'VE' THEN 'Venezuela'
    WHEN 'VG' THEN 'British Virgin Islands'
    WHEN 'VI' THEN 'U.S. Virgin Islands'
    WHEN 'VN' THEN 'Vietnam'
    WHEN 'VU' THEN 'Vanuatu'
    WHEN 'WF' THEN 'Wallis & Futuna'
    WHEN 'WS' THEN 'Samoa'
    WHEN 'YE' THEN 'Yemen'
    WHEN 'YT' THEN 'Mayotte'
    WHEN 'ZA' THEN 'South Africa'
    WHEN 'ZM' THEN 'Zambia'
    WHEN 'ZW' THEN 'Zimbabwe'
    ELSE NULL
  END;
$country$;
REVOKE ALL ON FUNCTION private.participation_country_name(text) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.normalize_participation_region(p_region text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = ''
AS $region$
  SELECT NULLIF(regexp_replace(p_region, '^[[:space:]]+|[[:space:]]+$', '', 'g'), '');
$region$;
REVOKE ALL ON FUNCTION private.normalize_participation_region(text) FROM PUBLIC, anon, authenticated;

ALTER TABLE public.student_responses
  ADD COLUMN country_code text,
  ADD COLUMN country_name text,
  ADD COLUMN region text;
ALTER TABLE public.specialist_responses
  ADD COLUMN country_code text,
  ADD COLUMN country_name text,
  ADD COLUMN region text;

ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_geography_check CHECK (
    (submission_schema_version >= 5
      OR (country_code IS NULL AND country_name IS NULL AND region IS NULL))
    AND (
      (country_code IS NULL AND country_name IS NULL AND region IS NULL)
      OR (
        country_code IS NOT NULL AND country_name IS NOT NULL
        AND private.participation_country_name(country_code) IS NOT NULL
        AND country_name = private.participation_country_name(country_code)
        AND (region IS NULL OR (
          private.normalize_participation_region(region) IS NOT NULL
          AND region = private.normalize_participation_region(region)
          AND char_length(region) BETWEEN 1 AND 100
          AND octet_length(region) <= 400
          AND region !~ '[[:cntrl:]]'
        ))
      )
    )
  );
COMMENT ON COLUMN public.student_responses.country_code IS
  'Voluntarily supplied ISO 3166-1 alpha-2 country. NULL means not supplied, never inferred.';
COMMENT ON COLUMN public.student_responses.country_name IS
  'English country label derived by the validated writer from the canonical ISO code.';
COMMENT ON COLUMN public.student_responses.region IS
  'Optional self-reported region/state; private research data, never included in public map statistics.';
CREATE INDEX student_responses_map_publication_idx
  ON public.student_responses (created_at, country_code, language, questionnaire_version, submission_schema_version)
  WHERE country_code IS NOT NULL AND submission_schema_version = 5;

ALTER TABLE public.specialist_responses
  ADD CONSTRAINT specialist_responses_geography_check CHECK (
    (submission_schema_version >= 3
      OR (country_code IS NULL AND country_name IS NULL AND region IS NULL))
    AND (
      (country_code IS NULL AND country_name IS NULL AND region IS NULL)
      OR (
        country_code IS NOT NULL AND country_name IS NOT NULL
        AND private.participation_country_name(country_code) IS NOT NULL
        AND country_name = private.participation_country_name(country_code)
        AND (region IS NULL OR (
          private.normalize_participation_region(region) IS NOT NULL
          AND region = private.normalize_participation_region(region)
          AND char_length(region) BETWEEN 1 AND 100
          AND octet_length(region) <= 400
          AND region !~ '[[:cntrl:]]'
        ))
      )
    )
  );
COMMENT ON COLUMN public.specialist_responses.country_code IS
  'Voluntarily supplied ISO 3166-1 alpha-2 country. NULL means not supplied, never inferred.';
COMMENT ON COLUMN public.specialist_responses.country_name IS
  'English country label derived by the validated writer from the canonical ISO code.';
COMMENT ON COLUMN public.specialist_responses.region IS
  'Optional self-reported region/state; private research data, never included in public map statistics.';
CREATE INDEX specialist_responses_map_publication_idx
  ON public.specialist_responses (created_at, country_code, language, questionnaire_version, submission_schema_version)
  WHERE country_code IS NOT NULL AND submission_schema_version = 3 AND questionnaire_completed;

-- Extend current checks explicitly; historical schema/consent pairs stay intact.
ALTER TABLE public.student_responses DROP CONSTRAINT student_responses_payload_v4_check;
ALTER TABLE public.student_responses
  ADD CONSTRAINT student_responses_payload_v4_check
  CHECK (
    (
      submission_schema_version = 0
      AND participant_role = 'student'
      AND medicine_view IS NULL
      AND participant_reflection_version IS NULL
    )
    OR (
      submission_schema_version = 1
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND scoring_version = 'client-scoring-v1'
      AND consent_version = 'research-consent-2026-08-26'
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_client_scores_v1(client_scores)
      AND language IN ('en', 'ro', 'fr')
      AND (study_year IS NULL OR study_year BETWEEN 1 AND 12)
      AND (
        preferred_specialty IS NULL
        OR private.valid_specialty_v1(preferred_specialty)
      )
      AND participant_role = 'student'
      AND medicine_view IS NULL
      AND participant_reflection_version IS NULL
    )
    OR (
      submission_schema_version = 2
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND scoring_version = 'client-scoring-v2'
      AND consent_version = 'research-consent-2026-09-04'
      AND specialty_config_version_id IS NOT NULL
      AND specialty_config_revision IS NOT NULL
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_client_scores_v1(client_scores)
      AND language IN ('en', 'ro', 'fr')
      AND (study_year IS NULL OR study_year BETWEEN 1 AND 12)
      AND (
        preferred_specialty IS NULL
        OR private.valid_specialty_v1(preferred_specialty)
      )
      AND participant_role = 'student'
      AND medicine_view IS NULL
      AND participant_reflection_version IS NULL
    )
    OR (
      submission_schema_version = 3
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND scoring_version = 'client-scoring-v2'
      AND consent_version = 'research-consent-2026-09-11'
      AND specialty_config_version_id IS NOT NULL
      AND specialty_config_revision IS NOT NULL
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_client_scores_v1(client_scores)
      AND language IN ('en', 'ro', 'fr')
      AND participant_role IN ('student', 'curious')
      AND (study_year IS NULL OR study_year BETWEEN 1 AND 6)
      AND (participant_role = 'student' OR study_year IS NULL)
      AND (
        preferred_specialty IS NULL
        OR private.valid_specialty_v1(preferred_specialty)
      )
      AND participant_reflection_version IS NOT NULL
      AND participant_reflection_version = 'medicine-view-v1'
      AND medicine_view IS NOT NULL
      AND medicine_view = regexp_replace(
        medicine_view,
        '^[[:space:]]+|[[:space:]]+$',
        '',
        'g'
      )
      AND char_length(medicine_view) BETWEEN 3 AND 2000
      AND octet_length(medicine_view) <= 8000
    )
    OR (
      submission_schema_version IN (4, 5)
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND scoring_version = 'client-scoring-v2'
      AND (
        (submission_schema_version = 4 AND consent_version = 'research-consent-2026-09-16')
        OR (submission_schema_version = 5 AND consent_version = 'research-consent-2026-09-16-geography')
      )
      AND specialty_config_version_id IS NOT NULL
      AND specialty_config_revision IS NOT NULL
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_client_scores_v1(client_scores)
      AND language IN ('en', 'ro', 'fr')
      AND participant_role IN ('student', 'curious')
      AND (study_year IS NULL OR study_year BETWEEN 1 AND 6)
      AND (participant_role = 'student' OR study_year IS NULL)
      AND (
        preferred_specialty IS NULL
        OR private.valid_specialty_v1(preferred_specialty)
      )
      AND participant_reflection_version IS NOT NULL
      AND participant_reflection_version = 'medicine-view-optional-v2'
      AND (
        medicine_view IS NULL
        OR (
          medicine_view = regexp_replace(
            medicine_view,
            '^[[:space:]]+|[[:space:]]+$',
            '',
            'g'
          )
          AND char_length(medicine_view) BETWEEN 3 AND 2000
          AND octet_length(medicine_view) <= 8000
        )
      )
    )
  ) NOT VALID;

ALTER TABLE public.student_responses
  VALIDATE CONSTRAINT student_responses_payload_v4_check;

ALTER TABLE public.specialist_responses DROP CONSTRAINT specialist_responses_payload_v2_check;
ALTER TABLE public.specialist_responses
  ADD CONSTRAINT specialist_responses_payload_v2_check
  CHECK (
    submission_schema_version = 0
    OR (
      submission_schema_version = 1
      AND questionnaire_completed
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND calibration_version = 'calibration-v1'
      AND consent_version = 'research-consent-2026-08-26'
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_specialty_v1(actual_specialty)
      AND language IN ('en', 'ro', 'fr')
      AND (years_of_experience IS NULL OR years_of_experience BETWEEN 0 AND 60)
      AND (career_satisfaction IS NULL OR career_satisfaction BETWEEN 1 AND 5)
      AND (
        would_choose_again_code IS NULL
        OR would_choose_again_code IN ('yes', 'no', 'unsure')
      )
      AND (
        intention_to_change_code IS NULL
        OR intention_to_change_code IN (
          'definitely', 'probably', 'probably_not', 'definitely_not'
        )
      )
      AND (
        voluntary_choice_code IS NULL
        OR voluntary_choice_code IN (
          'fully_voluntary', 'somewhat_voluntary', 'not_voluntary'
        )
      )
      AND current_specialty_view IS NULL
      AND specialty_changes_over_years IS NULL
      AND most_important_specialty_quality IS NULL
      AND would_not_choose_again_reason IS NULL
      AND student_self_question IS NULL
    )
    OR (
      submission_schema_version IN (2, 3)
      AND questionnaire_version = 'q81-v1'
      AND value_catalog_version = 'career-values-v1'
      AND specialty_catalog_version = 'medical-specialties-v1'
      AND calibration_version = 'calibration-v2-qualitative'
      AND (
        (submission_schema_version = 2 AND consent_version = 'research-consent-2026-09-04')
        OR (submission_schema_version = 3 AND consent_version = 'research-consent-2026-09-16-geography')
      )
      AND specialty_config_version_id IS NOT NULL
      AND specialty_config_revision IS NOT NULL
      AND (
        (
          questionnaire_completed
          AND private.valid_ratings_q81_v1(ratings)
          AND private.valid_selected_values_v1(selected_values)
        )
        OR (
          NOT questionnaire_completed
          AND ratings = '{}'::jsonb
          AND selected_values = '[]'::jsonb
        )
      )
      AND private.valid_specialty_v1(actual_specialty)
      AND language IN ('en', 'ro', 'fr')
      AND years_of_experience IS NULL
      AND career_satisfaction IS NULL
      AND would_choose_again IS NULL
      AND intention_to_change IS NULL
      AND voluntary_choice IS NULL
      AND intention_to_change_code IS NULL
      AND voluntary_choice_code IS NULL
      AND would_choose_again_code IS NOT NULL
      AND would_choose_again_code IN ('yes', 'no')
      AND current_specialty_view IS NOT NULL
      AND current_specialty_view = btrim(current_specialty_view)
      AND char_length(current_specialty_view) BETWEEN 3 AND 2000
      AND specialty_changes_over_years IS NOT NULL
      AND specialty_changes_over_years = btrim(specialty_changes_over_years)
      AND char_length(specialty_changes_over_years) BETWEEN 3 AND 2000
      AND most_important_specialty_quality IS NOT NULL
      AND most_important_specialty_quality = btrim(most_important_specialty_quality)
      AND char_length(most_important_specialty_quality) BETWEEN 3 AND 2000
      AND student_self_question IS NOT NULL
      AND student_self_question = btrim(student_self_question)
      AND char_length(student_self_question) BETWEEN 3 AND 1000
      AND (
        (
          would_choose_again_code = 'yes'
          AND would_not_choose_again_reason IS NULL
        )
        OR (
          would_choose_again_code = 'no'
          AND would_not_choose_again_reason IS NOT NULL
          AND would_not_choose_again_reason = btrim(would_not_choose_again_reason)
          AND char_length(would_not_choose_again_reason) BETWEEN 3 AND 2000
        )
      )
    )
  ) NOT VALID;

ALTER TABLE public.specialist_responses
  VALIDATE CONSTRAINT specialist_responses_payload_v2_check;

CREATE OR REPLACE FUNCTION private.submit_student_response_v6(
  p_submission_id uuid,
  p_participant_role text,
  p_medicine_view text,
  p_study_year integer,
  p_preferred_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_client_scores jsonb,
  p_language text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_scoring_version text,
  p_consent_version text,
  p_participant_reflection_version text,
  p_specialty_config_version_id uuid,
  p_country_code text,
  p_region text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
  resolved_revision bigint;
  normalized_country_code text;
  normalized_region text;
  normalized_medicine_view text;
BEGIN
  normalized_country_code := upper(private.normalize_participation_region(p_country_code));
  normalized_region := private.normalize_participation_region(p_region);
  IF (normalized_country_code IS NOT NULL
      AND private.participation_country_name(normalized_country_code) IS NULL)
     OR (normalized_country_code IS NULL AND normalized_region IS NOT NULL)
     OR (normalized_region IS NOT NULL AND (
       char_length(normalized_region) NOT BETWEEN 1 AND 100
       OR octet_length(normalized_region) > 400
       OR normalized_region ~ '[[:cntrl:]]'
     )) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid voluntary geography';
  END IF;

  normalized_medicine_view := NULLIF(
    regexp_replace(
      p_medicine_view,
      '^[[:space:]]+|[[:space:]]+$',
      '',
      'g'
    ),
    ''
  );

  IF p_submission_id IS NULL
     OR p_participant_role IS NULL
     OR p_participant_role NOT IN ('student', 'curious')
     OR (
       normalized_medicine_view IS NOT NULL
       AND (
         char_length(normalized_medicine_view) NOT BETWEEN 3 AND 2000
         OR octet_length(normalized_medicine_view) > 8000
       )
     )
     OR p_questionnaire_version IS DISTINCT FROM 'q81-v1'
     OR p_value_catalog_version IS DISTINCT FROM 'career-values-v1'
     OR p_specialty_catalog_version IS DISTINCT FROM 'medical-specialties-v1'
     OR p_scoring_version IS DISTINCT FROM 'client-scoring-v2'
     OR p_consent_version IS DISTINCT FROM 'research-consent-2026-09-16-geography'
     OR p_participant_reflection_version IS DISTINCT FROM 'medicine-view-optional-v2'
     OR private.valid_ratings_q81_v1(p_ratings) IS NOT TRUE
     OR private.valid_selected_values_v1(p_selected_values) IS NOT TRUE
     OR private.valid_client_scores_v1(p_client_scores) IS NOT TRUE
     OR p_language IS NULL
     OR p_language NOT IN ('en', 'ro', 'fr')
     OR (p_study_year IS NOT NULL AND p_study_year NOT BETWEEN 1 AND 6)
     OR (p_participant_role = 'curious' AND p_study_year IS NOT NULL)
     OR (
       p_preferred_specialty IS NOT NULL
       AND private.valid_specialty_v1(p_preferred_specialty) IS NOT TRUE
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid participant research submission';
  END IF;

  IF p_specialty_config_version_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A specialty catalog version id is required';
  END IF;

  resolved_revision := private.resolve_published_specialty_config_revision(
    p_specialty_config_version_id
  );

  INSERT INTO public.student_responses (
    id,
    participant_role,
    medicine_view,
    participant_reflection_version,
    study_year,
    preferred_specialty,
    ratings,
    selected_values,
    client_scores,
    language,
    submission_schema_version,
    questionnaire_version,
    value_catalog_version,
    specialty_catalog_version,
    scoring_version,
    consent_version,
    specialty_config_version_id,
    specialty_config_revision,
    country_code,
    country_name,
    region
  ) VALUES (
    p_submission_id,
    p_participant_role,
    normalized_medicine_view,
    'medicine-view-optional-v2',
    p_study_year,
    p_preferred_specialty,
    p_ratings,
    p_selected_values,
    p_client_scores,
    p_language,
    5,
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'client-scoring-v2',
    'research-consent-2026-09-16-geography',
    p_specialty_config_version_id,
    resolved_revision,
    normalized_country_code,
    private.participation_country_name(normalized_country_code),
    normalized_region
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT response.id INTO inserted_id
    FROM public.student_responses AS response
    WHERE response.id = p_submission_id
      AND response.participant_role = p_participant_role
      AND response.medicine_view IS NOT DISTINCT FROM normalized_medicine_view
      AND response.participant_reflection_version = 'medicine-view-optional-v2'
      AND response.study_year IS NOT DISTINCT FROM p_study_year
      AND response.preferred_specialty IS NOT DISTINCT FROM p_preferred_specialty
      AND response.ratings = p_ratings
      AND response.selected_values = p_selected_values
      AND response.client_scores = p_client_scores
      AND response.language = p_language
      AND response.submission_schema_version = 5
      AND response.questionnaire_version = 'q81-v1'
      AND response.value_catalog_version = 'career-values-v1'
      AND response.specialty_catalog_version = 'medical-specialties-v1'
      AND response.scoring_version = 'client-scoring-v2'
      AND response.consent_version = 'research-consent-2026-09-16-geography'
      AND response.specialty_config_version_id = p_specialty_config_version_id
      AND response.specialty_config_revision = resolved_revision
      AND response.country_code IS NOT DISTINCT FROM normalized_country_code
      AND response.region IS NOT DISTINCT FROM normalized_region;

    IF inserted_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Submission id already exists with a different payload';
    END IF;
  END IF;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_student_response_v6(
  p_submission_id uuid,
  p_participant_role text,
  p_medicine_view text,
  p_study_year integer,
  p_preferred_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_client_scores jsonb,
  p_language text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_scoring_version text,
  p_consent_version text,
  p_participant_reflection_version text,
  p_specialty_config_version_id uuid,
  p_country_code text,
  p_region text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_student_response_v6(
    p_submission_id,
    p_participant_role,
    p_medicine_view,
    p_study_year,
    p_preferred_specialty,
    p_ratings,
    p_selected_values,
    p_client_scores,
    p_language,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_scoring_version,
    p_consent_version,
    p_participant_reflection_version,
    p_specialty_config_version_id,
    p_country_code,
    p_region
  );
$$;

REVOKE ALL ON FUNCTION private.submit_student_response_v6(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.submit_student_response_v6(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_student_response_v6(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid, text, text
) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_student_response_v6(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid, text, text
) IS
  'Validated idempotent schema-5 submission for medical students and medicine explorers; the versioned medicine-view answer is optional and blank input is stored as NULL.';

COMMENT ON FUNCTION private.submit_student_response_v6(
  uuid, text, text, integer, text, jsonb, jsonb, jsonb, text, text, text,
  text, text, text, text, uuid, text, text
) IS
  'Private validated writer for schema-5 student and medicine-explorer research submissions with an optional qualitative medicine view.';


CREATE OR REPLACE FUNCTION private.submit_specialist_response_v5(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_questionnaire_completed boolean,
  p_language text,
  p_current_specialty_view text,
  p_specialty_changes_over_years text,
  p_most_important_specialty_quality text,
  p_would_choose_again_code text,
  p_would_not_choose_again_reason text,
  p_student_self_question text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_calibration_version text,
  p_consent_version text,
  p_specialty_config_version_id uuid,
  p_country_code text,
  p_region text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inserted_id uuid;
  resolved_revision bigint;
  normalized_country_code text;
  normalized_region text;
  normalized_current_specialty_view text;
  normalized_specialty_changes_over_years text;
  normalized_most_important_specialty_quality text;
  normalized_would_not_choose_again_reason text;
  normalized_student_self_question text;
BEGIN
  normalized_country_code := upper(private.normalize_participation_region(p_country_code));
  normalized_region := private.normalize_participation_region(p_region);
  IF (normalized_country_code IS NOT NULL
      AND private.participation_country_name(normalized_country_code) IS NULL)
     OR (normalized_country_code IS NULL AND normalized_region IS NOT NULL)
     OR (normalized_region IS NOT NULL AND (
       char_length(normalized_region) NOT BETWEEN 1 AND 100
       OR octet_length(normalized_region) > 400
       OR normalized_region ~ '[[:cntrl:]]'
     )) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid voluntary geography';
  END IF;

  normalized_current_specialty_view := btrim(p_current_specialty_view);
  normalized_specialty_changes_over_years := btrim(p_specialty_changes_over_years);
  normalized_most_important_specialty_quality := btrim(p_most_important_specialty_quality);
  normalized_would_not_choose_again_reason := nullif(btrim(p_would_not_choose_again_reason), '');
  normalized_student_self_question := btrim(p_student_self_question);

  IF p_submission_id IS NULL
     OR p_questionnaire_version IS DISTINCT FROM 'q81-v1'
     OR p_value_catalog_version IS DISTINCT FROM 'career-values-v1'
     OR p_specialty_catalog_version IS DISTINCT FROM 'medical-specialties-v1'
     OR p_calibration_version IS DISTINCT FROM 'calibration-v2-qualitative'
     OR p_consent_version IS DISTINCT FROM 'research-consent-2026-09-16-geography'
     OR p_questionnaire_completed IS NULL
     OR (
       p_questionnaire_completed
       AND (
         private.valid_ratings_q81_v1(p_ratings) IS NOT TRUE
         OR private.valid_selected_values_v1(p_selected_values) IS NOT TRUE
       )
     )
     OR (
       NOT p_questionnaire_completed
       AND (
         p_ratings IS DISTINCT FROM '{}'::jsonb
         OR p_selected_values IS DISTINCT FROM '[]'::jsonb
       )
     )
     OR private.valid_specialty_v1(p_actual_specialty) IS NOT TRUE
     OR p_language IS NULL
     OR p_language NOT IN ('en', 'ro', 'fr')
     OR normalized_current_specialty_view IS NULL
     OR char_length(normalized_current_specialty_view) NOT BETWEEN 3 AND 2000
     OR normalized_specialty_changes_over_years IS NULL
     OR char_length(normalized_specialty_changes_over_years) NOT BETWEEN 3 AND 2000
     OR normalized_most_important_specialty_quality IS NULL
     OR char_length(normalized_most_important_specialty_quality) NOT BETWEEN 3 AND 2000
     OR normalized_student_self_question IS NULL
     OR char_length(normalized_student_self_question) NOT BETWEEN 3 AND 1000
     OR p_would_choose_again_code IS NULL
     OR p_would_choose_again_code NOT IN ('yes', 'no')
     OR (
       p_would_choose_again_code = 'yes'
       AND normalized_would_not_choose_again_reason IS NOT NULL
     )
     OR (
       p_would_choose_again_code = 'no'
       AND (
         normalized_would_not_choose_again_reason IS NULL
         OR char_length(normalized_would_not_choose_again_reason) NOT BETWEEN 3 AND 2000
       )
     ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'Invalid specialist research submission';
  END IF;

  IF p_specialty_config_version_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22023',
      MESSAGE = 'A specialty catalog version id is required';
  END IF;

  resolved_revision := private.resolve_published_specialty_config_revision(
    p_specialty_config_version_id
  );

  INSERT INTO public.specialist_responses (
    id,
    actual_specialty,
    ratings,
    selected_values,
    questionnaire_completed,
    language,
    years_of_experience,
    career_satisfaction,
    would_choose_again,
    intention_to_change,
    voluntary_choice,
    would_choose_again_code,
    intention_to_change_code,
    voluntary_choice_code,
    current_specialty_view,
    specialty_changes_over_years,
    most_important_specialty_quality,
    would_not_choose_again_reason,
    student_self_question,
    submission_schema_version,
    questionnaire_version,
    value_catalog_version,
    specialty_catalog_version,
    calibration_version,
    consent_version,
    specialty_config_version_id,
    specialty_config_revision,
    country_code,
    country_name,
    region
  ) VALUES (
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
    p_questionnaire_completed,
    p_language,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    p_would_choose_again_code,
    NULL,
    NULL,
    normalized_current_specialty_view,
    normalized_specialty_changes_over_years,
    normalized_most_important_specialty_quality,
    CASE
      WHEN p_would_choose_again_code = 'no'
        THEN normalized_would_not_choose_again_reason
      ELSE NULL
    END,
    normalized_student_self_question,
    3,
    'q81-v1',
    'career-values-v1',
    'medical-specialties-v1',
    'calibration-v2-qualitative',
    'research-consent-2026-09-16-geography',
    p_specialty_config_version_id,
    resolved_revision,
    normalized_country_code,
    private.participation_country_name(normalized_country_code),
    normalized_region
  )
  ON CONFLICT (id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT response.id INTO inserted_id
    FROM public.specialist_responses AS response
    WHERE response.id = p_submission_id
      AND response.actual_specialty = p_actual_specialty
      AND response.ratings = p_ratings
      AND response.selected_values = p_selected_values
      AND response.questionnaire_completed = p_questionnaire_completed
      AND response.language = p_language
      AND response.years_of_experience IS NULL
      AND response.career_satisfaction IS NULL
      AND response.would_choose_again IS NULL
      AND response.intention_to_change IS NULL
      AND response.voluntary_choice IS NULL
      AND response.would_choose_again_code = p_would_choose_again_code
      AND response.intention_to_change_code IS NULL
      AND response.voluntary_choice_code IS NULL
      AND response.current_specialty_view = normalized_current_specialty_view
      AND response.specialty_changes_over_years = normalized_specialty_changes_over_years
      AND response.most_important_specialty_quality = normalized_most_important_specialty_quality
      AND response.would_not_choose_again_reason IS NOT DISTINCT FROM CASE
        WHEN p_would_choose_again_code = 'no'
          THEN normalized_would_not_choose_again_reason
        ELSE NULL
      END
      AND response.student_self_question = normalized_student_self_question
      AND response.submission_schema_version = 3
      AND response.questionnaire_version = 'q81-v1'
      AND response.value_catalog_version = 'career-values-v1'
      AND response.specialty_catalog_version = 'medical-specialties-v1'
      AND response.calibration_version = 'calibration-v2-qualitative'
      AND response.consent_version = 'research-consent-2026-09-16-geography'
      AND response.specialty_config_version_id = p_specialty_config_version_id
      AND response.specialty_config_revision = resolved_revision
      AND response.country_code IS NOT DISTINCT FROM normalized_country_code
      AND response.region IS NOT DISTINCT FROM normalized_region;

    IF inserted_id IS NULL THEN
      RAISE EXCEPTION USING
        ERRCODE = '23505',
        MESSAGE = 'Submission id already exists with a different payload';
    END IF;
  END IF;

  RETURN inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_specialist_response_v5(
  p_submission_id uuid,
  p_actual_specialty text,
  p_ratings jsonb,
  p_selected_values jsonb,
  p_questionnaire_completed boolean,
  p_language text,
  p_current_specialty_view text,
  p_specialty_changes_over_years text,
  p_most_important_specialty_quality text,
  p_would_choose_again_code text,
  p_would_not_choose_again_reason text,
  p_student_self_question text,
  p_questionnaire_version text,
  p_value_catalog_version text,
  p_specialty_catalog_version text,
  p_calibration_version text,
  p_consent_version text,
  p_specialty_config_version_id uuid,
  p_country_code text,
  p_region text
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT private.submit_specialist_response_v5(
    p_submission_id,
    p_actual_specialty,
    p_ratings,
    p_selected_values,
    p_questionnaire_completed,
    p_language,
    p_current_specialty_view,
    p_specialty_changes_over_years,
    p_most_important_specialty_quality,
    p_would_choose_again_code,
    p_would_not_choose_again_reason,
    p_student_self_question,
    p_questionnaire_version,
    p_value_catalog_version,
    p_specialty_catalog_version,
    p_calibration_version,
    p_consent_version,
    p_specialty_config_version_id,
    p_country_code,
    p_region
  );
$$;

REVOKE ALL ON FUNCTION private.submit_specialist_response_v5(
  uuid, text, jsonb, jsonb, boolean, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.submit_specialist_response_v5(
  uuid, text, jsonb, jsonb, boolean, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.submit_specialist_response_v5(
  uuid, text, jsonb, jsonb, boolean, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid, text, text
) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_specialist_response_v5(
  uuid, text, jsonb, jsonb, boolean, text, text, text, text, text, text, text,
  text, text, text, text, text, uuid, text, text
) IS
  'Validated schema-3 specialist ingestion endpoint. The q81 payload is complete or explicitly skipped; qualitative answers and published-catalog provenance remain mandatory.';
-- Monthly disjoint cells are the only source of the public map. Suppressed
-- counts are never retained in this release table or added to public totals.
CREATE TABLE private.participation_map_months (
  month date PRIMARY KEY CHECK (extract(day FROM month) = 1),
  published_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  cell_count integer NOT NULL CHECK (cell_count >= 0)
);
CREATE TABLE private.participation_map_cells (
  month date NOT NULL REFERENCES private.participation_map_months(month)
    DEFERRABLE INITIALLY DEFERRED,
  country_code text NOT NULL CHECK (private.participation_country_name(country_code) IS NOT NULL),
  respondent_type text NOT NULL CHECK (respondent_type IN ('student', 'specialist', 'non_medical')),
  language text NOT NULL CHECK (language IN ('en', 'fr', 'ro')),
  questionnaire_version text NOT NULL,
  data_version text NOT NULL,
  response_count bigint NOT NULL CHECK (response_count >= 10 AND response_count % 5 = 0),
  PRIMARY KEY (month, country_code, respondent_type, language, questionnaire_version, data_version)
);
CREATE INDEX participation_map_cells_country_filters_idx
  ON private.participation_map_cells (country_code, respondent_type, language, month);
CREATE INDEX participation_map_cells_version_month_idx
  ON private.participation_map_cells (questionnaire_version, data_version, month);
ALTER TABLE private.participation_map_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.participation_map_cells ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.participation_map_months, private.participation_map_cells
  FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION private.protect_participation_map_release()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $protect$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Published participation map months are immutable';
  END IF;
  IF EXISTS (SELECT 1 FROM private.participation_map_months WHERE month = NEW.month) THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Published participation map months are immutable';
  END IF;
  RETURN NEW;
END;
$protect$;
REVOKE ALL ON FUNCTION private.protect_participation_map_release() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_participation_map_cells
  BEFORE INSERT OR UPDATE OR DELETE ON private.participation_map_cells
  FOR EACH ROW EXECUTE FUNCTION private.protect_participation_map_release();
CREATE TRIGGER protect_participation_map_months
  BEFORE UPDATE OR DELETE ON private.participation_map_months
  FOR EACH ROW EXECUTE FUNCTION private.protect_participation_map_release();

CREATE FUNCTION private.publish_participation_map_month(p_month date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $publish$
DECLARE
  published_cells integer;
  month_start timestamptz;
  month_end timestamptz;
BEGIN
  IF p_month IS NULL OR extract(day FROM p_month) <> 1
     OR p_month >= date_trunc('month', transaction_timestamp() AT TIME ZONE 'UTC')::date THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Only a complete closed UTC month can be published';
  END IF;
  -- Serialize publication of this single month, including empty months.
  PERFORM pg_advisory_xact_lock(hashtext('q-pro-participation-map'), p_month - date '2000-01-01');
  IF EXISTS (SELECT 1 FROM private.participation_map_months WHERE month = p_month) THEN
    RETURN 0;
  END IF;
  month_start := p_month::timestamp AT TIME ZONE 'UTC';
  month_end := (p_month + interval '1 month')::timestamp AT TIME ZONE 'UTC';

  INSERT INTO private.participation_map_cells (
    month, country_code, respondent_type, language, questionnaire_version, data_version, response_count
  )
  SELECT p_month, country_code, respondent_type, language, questionnaire_version, data_version,
    (count(*) / 5) * 5
  FROM (
    SELECT country_code,
      CASE participant_role WHEN 'curious' THEN 'non_medical' ELSE 'student' END AS respondent_type,
      language, questionnaire_version, 'participant-v5'::text AS data_version
    FROM public.student_responses
    WHERE created_at >= month_start AND created_at < month_end
      AND country_code IS NOT NULL AND submission_schema_version = 5
      AND consent_version = 'research-consent-2026-09-16-geography'
      AND questionnaire_version = 'q81-v1'
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
      AND private.valid_client_scores_v1(client_scores)
    UNION ALL
    SELECT country_code, 'specialist', language, questionnaire_version, 'specialist-v3'
    FROM public.specialist_responses
    WHERE created_at >= month_start AND created_at < month_end
      AND country_code IS NOT NULL AND submission_schema_version = 3
      AND consent_version = 'research-consent-2026-09-16-geography'
      AND questionnaire_version = 'q81-v1' AND questionnaire_completed
      AND private.valid_ratings_q81_v1(ratings)
      AND private.valid_selected_values_v1(selected_values)
  ) AS consented_complete_questionnaires
  GROUP BY country_code, respondent_type, language, questionnaire_version, data_version
  HAVING count(*) >= 10;
  GET DIAGNOSTICS published_cells = ROW_COUNT;
  -- Deferred FK permits sealing the month after inserting its cells. Once
  -- sealed, even a privileged accidental replay cannot amend any released cell.
  INSERT INTO private.participation_map_months (month, cell_count) VALUES (p_month, published_cells);
  RETURN published_cells;
END;
$publish$;
REVOKE ALL ON FUNCTION private.publish_participation_map_month(date) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;
GRANT EXECUTE ON FUNCTION private.publish_participation_map_month(date) TO service_role;

CREATE FUNCTION private.get_participation_map_stats(
  p_respondent_type text DEFAULT 'all',
  p_country_code text DEFAULT NULL,
  p_language text DEFAULT 'all',
  p_month_from date DEFAULT NULL,
  p_month_to date DEFAULT NULL,
  p_data_version text DEFAULT 'all'
)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $stats$
DECLARE
  result jsonb;
  country_filter text := upper(private.normalize_participation_region(p_country_code));
  current_month date := date_trunc('month', transaction_timestamp() AT TIME ZONE 'UTC')::date;
BEGIN
  IF p_respondent_type IS NULL OR p_respondent_type NOT IN ('all', 'student', 'specialist', 'non_medical')
     OR p_language IS NULL OR p_language NOT IN ('all', 'en', 'fr', 'ro')
     OR p_data_version IS NULL OR p_data_version NOT IN ('all', 'current')
     OR (country_filter IS NOT NULL AND private.participation_country_name(country_filter) IS NULL)
     OR (p_month_from IS NOT NULL AND (extract(day FROM p_month_from) <> 1 OR p_month_from >= current_month))
     OR (p_month_to IS NOT NULL AND (extract(day FROM p_month_to) <> 1 OR p_month_to >= current_month))
     OR (p_month_from IS NOT NULL AND p_month_to IS NOT NULL AND p_month_from > p_month_to) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Invalid participation map filters';
  END IF;

  WITH country_totals AS (
    SELECT country_code, sum(response_count)::bigint AS total,
      coalesce(sum(response_count) FILTER (WHERE respondent_type = 'student'), 0)::bigint AS students,
      coalesce(sum(response_count) FILTER (WHERE respondent_type = 'specialist'), 0)::bigint AS specialists,
      coalesce(sum(response_count) FILTER (WHERE respondent_type = 'non_medical'), 0)::bigint AS non_medical
    FROM private.participation_map_cells
    WHERE (p_respondent_type = 'all' OR respondent_type = p_respondent_type)
      AND (country_filter IS NULL OR country_code = country_filter)
      AND (p_language = 'all' OR language = p_language)
      AND (p_month_from IS NULL OR month >= p_month_from)
      AND (p_month_to IS NULL OR month <= p_month_to)
      AND (p_data_version = 'all' OR (
        questionnaire_version = 'q81-v1'
        AND data_version IN ('participant-v5', 'specialist-v3')
      ))
    GROUP BY country_code
  )
  SELECT jsonb_build_object(
    'total', coalesce(sum(total), 0),
    'countries', count(*),
    'students', coalesce(sum(students), 0),
    'specialists', coalesce(sum(specialists), 0),
    'nonMedical', coalesce(sum(non_medical), 0),
    'groups', coalesce(jsonb_agg(jsonb_build_object(
      'countryCode', country_code, 'country', private.participation_country_name(country_code),
      'count', total, 'students', students, 'specialists', specialists, 'nonMedical', non_medical
    ) ORDER BY country_code), '[]'::jsonb),
    'privacyThreshold', 10,
    'rounding', 5,
    'granularity', 'month',
    'publishedThrough', (SELECT (max(month) + interval '1 month - 1 day')::date FROM private.participation_map_months)
  ) INTO result FROM country_totals;
  RETURN result;
END;
$stats$;
REVOKE ALL ON FUNCTION private.get_participation_map_stats(text, text, text, date, date, text)
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.get_participation_map_stats(
  p_respondent_type text DEFAULT 'all',
  p_country_code text DEFAULT NULL,
  p_language text DEFAULT 'all',
  p_month_from date DEFAULT NULL,
  p_month_to date DEFAULT NULL,
  p_data_version text DEFAULT 'all'
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $public_stats$
  SELECT private.get_participation_map_stats(
    p_respondent_type, p_country_code, p_language, p_month_from, p_month_to, p_data_version
  );
$public_stats$;
REVOKE ALL ON FUNCTION public.get_participation_map_stats(text, text, text, date, date, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_participation_map_stats(text, text, text, date, date, text)
  TO anon, authenticated;
COMMENT ON FUNCTION public.get_participation_map_stats(text, text, text, date, date, text) IS
  'Public country-level sums of immutable closed-month releases only. Cells below ten excluded; counts rounded down to five. Inclusive month boundaries. No raw response access, dates, IDs, regions or specialty filters.';

-- pg_cron runs with the migration owner's database role. Public API roles have
-- no ability to publish releases or run arbitrary cron jobs through this code.
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
SELECT cron.schedule(
  'q-pro-publish-participation-map',
  '15 1 1 * *',
  $cron$SELECT private.publish_participation_map_month(
    (date_trunc('month', transaction_timestamp() AT TIME ZONE 'UTC') - interval '1 month')::date
  );$cron$
);

-- Publish the already closed month (normally empty on introduction). No
-- historical location or old-consent rows are fabricated for this release.
SELECT private.publish_participation_map_month(
  (date_trunc('month', transaction_timestamp() AT TIME ZONE 'UTC') - interval '1 month')::date
);
NOTIFY pgrst, 'reload schema';
COMMIT;
